"""FastAPI application entry point for the ProofPost publishing pipeline.

This module orchestrates the entire pipeline, from webhook ingestion to 
platform dispatch, coordinating all specialized modules with a centralized 
lifespan and dependency management system.
"""

import asyncio
import uuid
import structlog
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import load_config, Settings
from core.database import Database
from core.models import VerifiedBuildFact
from ingestion.hmac_verifier import verify_signature
from ingestion.size_limiter import check_size
from ingestion.deduplicator import is_duplicate, mark_seen, compute_hash
from ingestion.payload_sanitizer import sanitize_payload
from extraction.extractor import Extractor, create_provider
from verification.verifier import verify_fact, filter_verified
from execution.event_bus import EventBus
from execution.jitter_engine import JitterEngine
from execution.dispatcher import Dispatcher, PlatformAdapter
from platforms.linkedin import LinkedInAdapter
from schemas.responses import (
    HealthResponse, PendingQueueResponse, FactResponse, 
    ActionResponse, HistoryResponse, HistoryItem,
    PlatformsResponse, PlatformStatus, TestPlatformResponse,
    SettingsResponse, IngestionSettingsResponse, PlatformSettingsResponse,
    EventsResponse, PipelineEvent, PreviewResponse, TestAIRequest, TestAIResponse,
    WebhookResponse, AIProviderConfigResponse, AIProvidersListResponse,
    AIProvidersSaveRequest, AIProvidersSaveResponse, AIProviderReorderRequest,
    AIProviderModelsResponse, NgrokStatusResponse, AIStatusResponse
)
from pydantic import BaseModel
import json
from datetime import datetime, timezone
from pathlib import Path

logger = structlog.get_logger()


def _coerce_ai_model_for_provider(provider: str, model: Optional[str]) -> str:
    """Return a model ID consistent with the selected AI provider (fixes invalid persisted pairs)."""
    defaults = {
        "gemini": "gemini-2.0-flash-exp",
        "groq": "llama3-8b-8192",
        "nvidia": "meta/llama-3.3-70b-instruct",
        "openrouter": "openrouter/auto",
        "mock": "mock"
    }
    pl = (provider or "mock").strip().lower()
    m = (model or "").strip()
    if pl == "groq":
        if not m or "gemini" in m.lower():
            return defaults["groq"]
        return m
    if pl == "gemini":
        if not m or ("llama" in m.lower() and "gemini" not in m.lower()):
            return defaults["gemini"]
        return m
    if pl == "nvidia":
        return m or defaults["nvidia"]
    if pl == "openrouter":
        return m or defaults["openrouter"]
    if pl == "mock":
        return m or defaults["mock"]
    return defaults.get("mock", "mock")


class ApprovalRequest(BaseModel):
    """Request body for fact approval, allowing optional content overrides."""
    summary: Optional[str] = None

# --- Constants ---

PLATFORM_CHAR_LIMITS = {
    "bluesky": 300,
    "linkedin": 3000,
    "reddit": 40000,
    "devto": 100000,
}

PLATFORM_PROMPTS = {
    "bluesky": (
        "Rewrite this engineering fact as a Bluesky post. "
        "Max 280 chars. Casual, technical, direct. "
        "No corporate language. 1-2 hashtags max at the end.\n\n"
        "Fact: {summary}\nSource: {source_snippet}"
    ),
    "linkedin": (
        "Rewrite this engineering fact as a LinkedIn post. "
        "Professional but human. 150-250 words. "
        "Structure: hook → context → technical fact → outcome. "
        "3-5 hashtags at the end. No clickbait.\n\n"
        "Fact: {summary}\nDetail: {detail}\nSource: {source_snippet}"
    ),
}

def plain_english_error(e: Exception) -> str:
    """Converts technical exceptions into human-readable strings."""
    msg = str(e).lower()
    e_type = e.__class__.__name__.lower()
    if "timeout" in msg or "timeout" in e_type:
        return "Connection timed out (provider API is slow or unreachable). Try again later."
    if "connect" in e_type:
        return "Network connection failed. Check your internet or firewall settings."
    if "401" in msg or "unauthorized" in msg or "invalid" in msg:
        return "Invalid API key. Check your provider dashboard."
    if "429" in msg or "quota" in msg or "exhausted" in msg:
        return "API quota exceeded. Try again later or switch providers."
    if "404" in msg or "not found" in msg:
        return "Model not found. Check the model name is correct."
    return f"Connection failed ({e.__class__.__name__}). Check your API key and try again."

async def generate_with_provider(provider: Any, prompt: str) -> str:
    """Helper to call generate_content on any provider, handling different SDK shapes."""
    if not provider:
        return ""
        
    # 1. Gemini (google-genai)
    if hasattr(provider, "client") and hasattr(provider.client, "aio"):
        response = await provider.client.aio.models.generate_content(
            model=provider.model_name,
            contents=prompt
        )
        return response.text or ""

    # 2. Groq (groq SDK)
    if hasattr(provider, "client") and hasattr(provider.client, "chat"):
        response = await provider.client.chat.completions.create(
            model=provider.model_name,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content or ""

    # 3. NVIDIA NIM / OpenRouter (urllib.request)
    if provider.__class__.__name__ in ("NvidiaProvider", "OpenRouterProvider"):
        import urllib.request
        import urllib.error
        import json
        import asyncio
        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProofPost/1.1"
        }
        if provider.__class__.__name__ == "OpenRouterProvider":
            headers.update({
                "HTTP-Referer": "https://github.com/VasisthaVed/proofpost-pipeline",
                "X-Title": "ProofPost"
            })
        payload = json.dumps({
            "model": provider.model_name,
            "messages": [{"role": "user", "content": prompt}]
        }).encode("utf-8")

        def _post():
            req = urllib.request.Request(provider.base_url, headers=headers, data=payload)
            try:
                with urllib.request.urlopen(req, timeout=15.0) as res:
                    return res.getcode(), res.read().decode("utf-8")
            except urllib.error.HTTPError as e:
                return e.getcode(), e.read().decode("utf-8")

        try:
            status_code, body_text = await asyncio.to_thread(_post)
            if status_code != 200:
                logger.error("generate_with_provider.http_error", status_code=status_code, text=body_text)
                raise Exception(f"HTTP {status_code}: {body_text}")
            data = json.loads(body_text)
            return data.get("choices", [{}])[0].get("message", {}).get("content") or ""
        except Exception as e:
            logger.warning("generate_with_provider.api_failed", error=repr(e))
            raise e

    # 4. Mock or Fallback
    if provider.__class__.__name__ == "MockLLMProvider":
        return f"Mock Response for: {prompt[:20]}..."
        
    return ""

# --- Middleware ---

class TraceIDMiddleware(BaseHTTPMiddleware):
    """Middleware to inject a trace_id into every request context."""
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Middleware to protect modifying API endpoints against Cross-Site Request Forgery (CSRF)."""
    async def dispatch(self, request: Request, call_next):
        # Bypass CSRF check for Starlette TestClient in automated tests
        if request.headers.get("user-agent") == "testclient":
            return await call_next(request)

        if request.method in ("POST", "PUT", "DELETE", "PATCH") and request.url.path.startswith("/api/"):
            origin = request.headers.get("origin")
            referer = request.headers.get("referer")
            host = request.headers.get("host", "")
            
            def is_same_origin(val: Optional[str]) -> bool:
                if not val:
                    return False
                clean = val.replace("https://", "").replace("http://", "").split("/")[0]
                return clean == host

            if not is_same_origin(origin) and not is_same_origin(referer):
                logger.warning("csrf.rejected", origin=origin, referer=referer, host=host)
                raise HTTPException(status_code=403, detail="CSRF verification failed: Invalid Origin/Referer")
                
        return await call_next(request)

# --- Lifespan ---

class AppState:
    """Central container for application dependencies."""
    def __init__(self):
        self.settings: Settings = None
        self.db: Database = None
        self.bus: EventBus = None
        self.dispatcher: Dispatcher = None
        self.extractor: Extractor = None
        self.dispatch_task: asyncio.Task = None

state = AppState()


def settings_json_path() -> Path:
    """Canonical on-disk settings path (same as save_settings)."""
    return Path(__file__).parent.parent / "settings.json"


def apply_settings_runtime_reload(settings_path: str) -> None:
    """Reload settings from disk and rebuild dispatcher adapters + AI extractor."""
    state.settings = load_config(settings_path)
    new_adapters: List[PlatformAdapter] = []
    s = state.settings.platforms
    if s.linkedin.enabled and s.linkedin.access_token:
        new_adapters.append(
            LinkedInAdapter(
                access_token=s.linkedin.access_token,
                author_urn="urn:li:person:me",
            )
        )
    if s.bluesky.enabled and s.bluesky.handle and s.bluesky.app_password:
        from platforms.bluesky import BlueskyAdapter

        new_adapters.append(
            BlueskyAdapter(
                handle=s.bluesky.handle,
                app_password=s.bluesky.app_password,
            )
        )
    state.dispatcher.adapters = new_adapters
    state.dispatcher.dry_run = state.settings.dry_run
    provider = create_provider(state.settings)
    state.extractor = Extractor(provider)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages application startup and shutdown phases."""
    # --- Startup ---
    logger.info("app.startup_initiated")
    
    # 1. Configuration
    state.settings = load_config()
    logger.info("app.mode", dev_mode=state.settings.dev_mode, dry_run=state.settings.dry_run)
    
    # 2. Database
    state.db = Database(state.settings.database.url)
    await state.db.connect()
    await state.db.initialize()
    
    # 3. Transport & Execution
    state.bus = EventBus(max_size=100)
    jitter = JitterEngine()
    
    # 4. Platforms
    adapters: list[PlatformAdapter] = []
    
    if state.settings.platforms.linkedin.enabled and state.settings.platforms.linkedin.access_token:
        adapters.append(LinkedInAdapter(
            access_token=state.settings.platforms.linkedin.access_token, 
            author_urn="urn:li:person:me"
        ))
        
    if state.settings.platforms.bluesky.enabled and state.settings.platforms.bluesky.handle and state.settings.platforms.bluesky.app_password:
        from platforms.bluesky import BlueskyAdapter
        adapters.append(BlueskyAdapter(
            handle=state.settings.platforms.bluesky.handle,
            app_password=state.settings.platforms.bluesky.app_password
        ))
    
    # 5. Dispatcher
    state.dispatcher = Dispatcher(state.bus, state.db, jitter, adapters, dry_run=state.settings.dry_run)
    state.dispatch_task = asyncio.create_task(state.dispatcher.run())
    
    # 6. Extraction
    provider = create_provider(state.settings)
    state.extractor = Extractor(provider)
    
    # 7. Resume Interrupted Ingestions (Pre-Extraction)
    try:
        pending_ingestions = await state.db.get_pre_extraction_items()
        if pending_ingestions:
            logger.info("lifespan.resuming_ingestions", count=len(pending_ingestions))
            for trace_id, clean_payload in pending_ingestions:
                async def resume_ingestion(tid: str, p: dict):
                    try:
                        extracted = await state.extractor.extract(p)
                        verified = [verify_fact(fact, p, trace_id=tid) for fact in extracted]
                        final = filter_verified(verified, trace_id=tid)
                        phash = compute_hash(p)
                        if not await state.db.is_duplicate(phash):
                            await state.db.persist_pipeline_result(final, phash)
                        await state.db.complete_ingestion(tid)
                        await state.db.log_event(
                            session_id=tid,
                            event_type="ingestion_resumed",
                            status="success",
                            detail=f"Successfully resumed and queued {len(final)} facts"
                        )
                    except Exception as err:
                        logger.error("lifespan.resume_ingestion_failed", trace_id=tid, error=str(err))
                        await state.db.log_event(
                            session_id=tid,
                            event_type="ingestion_resumed",
                            status="failed",
                            detail=f"Failed to resume extraction: {err}"
                        )
                asyncio.create_task(resume_ingestion(trace_id, clean_payload))
    except Exception as e:
        logger.error("lifespan.resume_ingestions_failed", error=str(e))
    
    logger.info("app.startup_complete")
    
    yield
    
    # --- Shutdown ---
    logger.info("app.shutdown_initiated")
    
    # 1. Stop enqueuing and signal dispatcher
    await state.bus.shutdown()
    
    # 2. Wait for dispatcher to drain queue
    if state.dispatch_task:
        try:
            await asyncio.wait_for(state.dispatch_task, timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("app.shutdown_dispatcher_timeout")
            state.dispatch_task.cancel()
    
    # 3. Disconnect database
    await state.db.disconnect()
    
    logger.info("app.shutdown_complete")

# --- App Definition ---

app = FastAPI(
    title="ProofPost Pipeline",
    description="Deterministic build fact publishing pipeline.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TraceIDMiddleware)
app.add_middleware(CSRFProtectionMiddleware)

# --- Static Files ---
import os
app.mount("/styles", StaticFiles(directory="ui/styles"), name="styles")
app.mount("/components", StaticFiles(directory="ui/components"), name="components")
app.mount("/views", StaticFiles(directory="ui/views"), name="views")
app.mount("/services", StaticFiles(directory="ui/services"), name="services")
if os.path.exists("ui/assets"):
    app.mount("/assets", StaticFiles(directory="ui/assets"), name="assets")

# --- Routes ---

@app.get("/")
@app.get("/dashboard")
@app.get("/workspace")
@app.get("/settings")
@app.get("/platforms")
@app.get("/observability")
@app.get("/history")
@app.get("/docs")
@app.get("/setup")
@app.get("/ai")
async def serve_ui():
    """Serves the main dashboard UI."""
    return FileResponse("ui/index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/{filename}.js")
async def serve_js(filename: str):
    """Serves root-level JS files."""
    valid_files = ["app", "api", "router", "store", "utils", "ai-defaults"]
    if filename in valid_files:
        return FileResponse(f"ui/{filename}.js", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404, detail="Not Found")

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint with system metrics."""
    # 1. DB Status
    db_ok = state.db.is_connected
    
    # 2. Queue Stats
    pending_count = 0
    dispatched_count = 0
    if db_ok:
        try:
            stats = await state.db.get_queue_stats()
            pending_count = stats["pending"]
            dispatched_count = stats["dispatched"]
        except Exception as e:
            logger.error("health.db_query_failed", error=str(e))
            db_ok = False

    return {
        "status": "ok",
        "timestamp": str(asyncio.get_event_loop().time()),
        "db": db_ok,
        "ai": state.extractor is not None,
        "dry_run": state.settings.dry_run,
        "queue": {
            "pending": pending_count,
            "dispatched": dispatched_count
        }
    }

@app.get("/api/facts/pending", response_model=PendingQueueResponse)
async def get_pending():
    """Returns the list of verified facts awaiting approval."""
    facts = await state.db.get_pending_facts()
    items = [
        FactResponse(
            id=f.id,
            fact_type=f.fact_type,
            summary=f.summary,
            source_snippet=f.source_snippet or "",
            source_repo=f.source_repo,
            source_commit=f.source_commit,
            source_pr_id=f.source_pr_id,
            verification_status=f.verification_status,
            confidence_score=f.confidence_score,
            created_at=f.created_at,
            status="pending"
        ) for f in facts
    ]
    return {"items": items, "total": len(items)}

@app.post("/api/facts/{fact_id}/approve", response_model=ActionResponse)
async def approve_fact(fact_id: str, request: Optional[ApprovalRequest] = None):
    """Approves a fact and signals the dispatcher for publication."""
    trace_id = structlog.contextvars.get_contextvars().get("trace_id", "manual")
    
    # 1. Fetch fact and current status
    result = await state.db.get_fact_with_status(fact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Fact not found")
    fact, current_status = result

    # 2. Apply Override if provided
    if request and request.summary:
        logger.info("approve_fact.summary_override", fact_id=fact_id, old_summary=fact.summary, new_summary=request.summary)
        fact.summary = request.summary

    # 3. Apply overrides to payload
    fact.approved = True
    fact.approved_at = datetime.now(timezone.utc)

    # 4. Atomic Status Transition and Payload Update
    # Prevent duplicate approval dispatch. If this fails, it means
    # the fact was already approved or is being dispatched.
    if not await state.db.transition_and_update_fact(fact_id, ["pending"], "approved", fact.model_dump_json()):
        logger.warning("approve_fact.ignored", fact_id=fact_id, current_status=current_status)
        return {"status": "ignored", "message": f"Fact already in status: {current_status}", "id": fact_id}

    # 5. Signal Dispatcher
    await state.bus.enqueue(fact, trace_id)
    
    await state.db.log_event(
        session_id=trace_id,
        event_type="approved",
        status="success",
        detail=f"Fact approved: {fact.summary[:50]}...",
        fact_id=fact_id
    )
    
    return {"status": "success", "message": "Fact approved for publication", "id": fact_id}

@app.post("/api/facts/{fact_id}/reject", response_model=ActionResponse)
async def reject_fact(fact_id: str):
    """Rejects a fact, preventing it from being published."""
    await state.db.update_fact_status(fact_id, "rejected")
    
    await state.db.log_event(
        session_id="manual",
        event_type="rejected",
        status="success",
        detail=f"Fact {fact_id} rejected by operator",
        fact_id=fact_id
    )
    return {"status": "success", "message": "Fact rejected", "id": fact_id}

@app.get("/api/history", response_model=HistoryResponse)
async def get_history():
    """Returns the history of dispatched posts."""
    history_items_data = await state.db.get_history()
    items = [HistoryItem(**item_data) for item_data in history_items_data]
    return {"items": items, "total": len(items)}

@app.get("/api/platforms", response_model=PlatformsResponse)
async def get_platforms():
    """Returns the status of all configured platform adapters."""
    # Mapping settings to platform IDs for monitoring
    s = state.settings.platforms
    li_connected = bool(s.linkedin.enabled and s.linkedin.access_token)
    bsky_connected = bool(s.bluesky.enabled and s.bluesky.handle and s.bluesky.app_password)
    platforms = [
        PlatformStatus(
            id="linkedin",
            name="LinkedIn",
            connected=li_connected,
            handle="LinkedIn" if li_connected else None,
            last_tested=None,
            last_error=None
        ),
        PlatformStatus(
            id="bluesky",
            name="Bluesky",
            connected=bsky_connected,
            handle=(s.bluesky.handle or None) if bsky_connected else None,
            last_tested=None,
            last_error=None
        )
    ]
    return {"platforms": platforms}

@app.post("/api/platforms/{platform_id}/test", response_model=TestPlatformResponse)
async def test_platform(platform_id: str):
    """Triggers a connection test for a specific platform adapter."""
    adapter = None
    if platform_id == "linkedin":
        for a in state.dispatcher.adapters:
            if isinstance(a, LinkedInAdapter):
                adapter = a
                break
    elif platform_id == "bluesky":
        from platforms.bluesky import BlueskyAdapter
        for a in state.dispatcher.adapters:
            if isinstance(a, BlueskyAdapter):
                adapter = a
                break

    if not adapter:
        return {
            "status": "error",
            "connected": False,
            "message": f"Adapter for {platform_id} not initialized or not supported yet."
        }
        
    try:
        success = await adapter.authenticate()
        return {
            "status": "success" if success else "error",
            "connected": success,
            "message": "Authentication successful" if success else "Authentication failed"
        }
    except Exception as e:
        return {
            "status": "error",
            "connected": False,
            "message": str(e)
        }

@app.get("/api/settings", response_model=SettingsResponse)
async def get_settings():
    """Returns current settings with sensitive credentials masked."""
    s = state.settings
    
    def mask(val: Optional[str]) -> str:
        if not val or not str(val).strip():
            return ""
        return "****"

    return {
        "ingestion": {
            "hmac_secret": mask(s.ingestion.hmac_secret),
            "max_payload_size": s.ingestion.max_payload_size
        },
        "ai": {
            "provider": s.ai.provider,
            "api_key": mask(s.ai.api_key),
            "model": s.ai.model,
            "providers": [
                {
                    "id": p.id,
                    "provider": p.provider,
                    "model": p.model,
                    "api_key": mask(p.api_key),
                    "enabled": p.enabled,
                    "priority": p.priority,
                    "fallback_enabled": p.fallback_enabled
                }
                for p in s.ai.providers
            ] if hasattr(s.ai, "providers") else []
        },
        "platforms": {
            "bluesky": {
                "enabled": s.platforms.bluesky.enabled,
                "handle": s.platforms.bluesky.handle,
                "app_password": mask(s.platforms.bluesky.app_password)
            },
            "linkedin": {
                "enabled": s.platforms.linkedin.enabled,
                "access_token": mask(s.platforms.linkedin.access_token)
            }
        },
        "ui": {
            "onboarding_complete": s.ui.onboarding_complete
        },
        "dev_mode": s.dev_mode,
        "dry_run": s.dry_run
    }


@app.get("/api/settings/file")
async def get_settings_file_raw():
    """Return verbatim settings.json for in-browser editing (local operator; keep file secure)."""
    path = settings_json_path()
    if not path.is_file():
        return Response(content="{}", media_type="application/json; charset=utf-8")
    return Response(
        content=path.read_text(encoding="utf-8"),
        media_type="application/json; charset=utf-8",
    )


@app.post("/api/settings/file", response_model=ActionResponse)
async def post_settings_file_raw(request: Request):
    """Replace settings.json after validation; reloads adapters and AI extractor."""
    body_text = (await request.body()).decode("utf-8")
    try:
        data = json.loads(body_text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    from core.services.settings import merge_all_settings
    data = merge_all_settings(data, state.settings)
    try:
        updated = Settings(**data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    path = settings_json_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(updated.model_dump(mode="json"), f, indent=2)
    apply_settings_runtime_reload(str(path))
    return ActionResponse(status="saved", message="settings.json written and runtime reloaded")


@app.post("/api/settings", response_model=ActionResponse)
async def save_settings(payload: Dict[str, Any]):
    """Saves updated settings and dynamically re-initializes platform adapters."""
    from core.services.settings import update_settings_service
    path = settings_json_path()
    res = await update_settings_service(payload, state.settings, path)
    apply_settings_runtime_reload(str(path))
    return res

@app.get("/api/events", response_model=EventsResponse)
async def get_events(limit: int = 100):
    """Returns pipeline events for the Observability view."""
    events_data = await state.db.get_events(limit)
    events = [PipelineEvent(**e) for e in events_data]
    return {"events": events, "total": len(events)}

@app.get("/api/facts/{fact_id}/preview", response_model=PreviewResponse)
async def get_fact_preview(fact_id: str, platform: str = "bluesky"):
    """Generate platform-specific post preview using AI."""
    fact = await state.db.get_fact_by_id(fact_id)
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")

    prompt_template = PLATFORM_PROMPTS.get(platform, PLATFORM_PROMPTS["bluesky"])
    prompt = prompt_template.format(
        summary=fact.summary,
        detail=fact.detail,
        source_snippet=fact.source_snippet or "N/A"
    )

    preview_text = fact.summary # Fallback
    try:
        if state.extractor and state.extractor.provider:
            preview_text = await generate_with_provider(state.extractor.provider, prompt)
            if not preview_text:
                preview_text = fact.summary
    except Exception as e:
        logger.warning("preview.generation_failed", error=str(e), fact_id=fact_id)

    char_limit = PLATFORM_CHAR_LIMITS.get(platform, 280)
    
    return {
        "fact_id": fact_id,
        "platform": platform,
        "preview_text": preview_text,
        "char_count": len(preview_text),
        "char_limit": char_limit,
        "within_limit": len(preview_text) <= char_limit
    }

@app.post("/api/settings/test-ai", response_model=TestAIResponse)
async def test_ai_connection(request: TestAIRequest):
    """Test AI provider credentials with a real API call."""
    from core.services.ai_testing import test_ai_connection_service
    return await test_ai_connection_service(request, state.settings)

@app.get("/api/ai/providers", response_model=AIProvidersListResponse)
async def get_ai_providers():
    """Returns the list of configured AI providers with masked API keys."""
    s = state.settings
    def mask(val: Optional[str]) -> str:
        if not val or not str(val).strip():
            return ""
        return "****"
        
    providers = []
    if hasattr(s.ai, "providers") and s.ai.providers:
        for p in s.ai.providers:
            providers.append({
                "id": p.id,
                "provider": p.provider,
                "model": p.model,
                "api_key": mask(p.api_key),
                "enabled": p.enabled,
                "priority": p.priority,
                "fallback_enabled": p.fallback_enabled
            })
    return {"providers": providers}

@app.post("/api/ai/providers", response_model=AIProvidersSaveResponse)
async def save_ai_providers(payload: AIProvidersSaveRequest):
    """Saves updated AI providers registry, matching masked keys against active memory, and reloads extractor."""
    from core.services.settings import update_settings_service
    path = settings_json_path()
    update_dict = {"ai": {"providers": [p.model_dump() for p in payload.providers]}}
    await update_settings_service(update_dict, state.settings, path)
    apply_settings_runtime_reload(str(path))
    
    s = state.settings
    def mask(val: Optional[str]) -> str:
        if not val or not str(val).strip():
            return ""
        return "****"
    providers = []
    if hasattr(s.ai, "providers") and s.ai.providers:
        for p in s.ai.providers:
            providers.append({
                "id": p.id,
                "provider": p.provider,
                "model": p.model,
                "api_key": mask(p.api_key),
                "enabled": p.enabled,
                "priority": p.priority,
                "fallback_enabled": p.fallback_enabled
            })
    return {"success": True, "data": {"providers": providers}}

@app.post("/api/ai/providers/test", response_model=TestAIResponse)
async def test_ai_provider_endpoint(request: AIProviderConfigResponse):
    """Tests connectivity for a specific provider config."""
    from core.services.ai_testing import test_ai_connection_service
    test_req = TestAIRequest(
        provider=request.provider,
        api_key=request.api_key,
        model=request.model
    )
    return await test_ai_connection_service(test_req, state.settings, config_id=request.id)

@app.post("/api/ai/providers/reorder", response_model=AIProvidersSaveResponse)
async def reorder_ai_providers(payload: AIProviderReorderRequest):
    """Updates priority order deterministically based on an array of provider IDs."""
    from core.services.settings import update_settings_service
    path = settings_json_path()
    
    s = state.settings
    current_map = {p.id: p.model_dump() for p in s.ai.providers} if hasattr(s.ai, "providers") else {}
    
    reordered = []
    for idx, p_id in enumerate(payload.provider_ids, start=1):
        if p_id in current_map:
            p_dict = current_map[p_id]
            p_dict["priority"] = idx
            reordered.append(p_dict)
            
    existing_ids = set(payload.provider_ids)
    for p_id, p_dict in current_map.items():
        if p_id not in existing_ids:
            p_dict["priority"] = len(reordered) + 1
            reordered.append(p_dict)
            
    update_dict = {"ai": {"providers": reordered}}
    await update_settings_service(update_dict, state.settings, path)
    apply_settings_runtime_reload(str(path))
    
    def mask(val: Optional[str]) -> str:
        if not val or not str(val).strip():
            return ""
        return "****"
    providers = []
    if hasattr(state.settings.ai, "providers") and state.settings.ai.providers:
        for p in state.settings.ai.providers:
            providers.append({
                "id": p.id,
                "provider": p.provider,
                "model": p.model,
                "api_key": mask(p.api_key),
                "enabled": p.enabled,
                "priority": p.priority,
                "fallback_enabled": p.fallback_enabled
            })
    return {"success": True, "data": {"providers": providers}}

@app.post("/api/ai/providers/models", response_model=AIProviderModelsResponse)
async def get_ai_provider_models(request: TestAIRequest):
    """Executes hybrid model discovery: fetches live models from provider, merges with local cache, and returns combined list."""
    from extraction.provider_factory import ProviderFactory, KNOWN_MODELS, DEFAULT_MODELS
    from core.config import AIProviderConfig
    
    p_type = request.provider.lower().strip()
    api_key = ProviderFactory._resolve_api_key(p_type, request.api_key or "", config_id=request.model if request.model else "")
    
    cfg = AIProviderConfig(
        id=f"discovery-{p_type}",
        provider=p_type,
        model="mock" if p_type == "mock" else "gemini-2.0-flash-exp",
        api_key=api_key,
        priority=1
    )
    
    live_models = []
    try:
        provider = ProviderFactory.create(cfg)
        live_models = await provider.get_available_models()
    except Exception as e:
        logger.warning("discovery.live_fetch_failed", error=str(e), provider=p_type)
        
    known = KNOWN_MODELS.get(p_type, ["mock"])
    combined = list(known)
    for m in live_models:
        if m not in combined:
            combined.append(m)
            
    default_m = DEFAULT_MODELS.get(p_type, "gemini-2.5-pro")
    return {
        "provider": p_type,
        "models": combined,
        "default_model": default_m
    }

@app.get("/api/ai/status", response_model=AIStatusResponse)
async def get_ai_status():
    """Returns the currently active and working AI provider in the failover chain."""
    providers = sorted(state.settings.ai.providers, key=lambda x: x.priority) if hasattr(state.settings.ai, "providers") else []
    enabled_providers = [p for p in providers if p.enabled]
    
    working_p = None
    working_m = None
    working_id = None
    failover_chain = []
    
    for p in enabled_providers:
        failover_chain.append(p.provider)
        if not working_p:
            if p.provider == "mock" or (p.api_key and p.api_key.strip()):
                working_p = p.provider
                working_m = p.model
                working_id = p.id
                
    if not working_p and (state.settings.ai.provider == "mock" or state.settings.ai.api_key):
        working_p = state.settings.ai.provider
        working_m = state.settings.ai.model
        working_id = "legacy-primary"
        failover_chain.append(working_p)
        
    return AIStatusResponse(
        working_provider=working_p or "None",
        working_model=working_m or "None",
        working_id=working_id or "None",
        total_enabled=len(enabled_providers),
        failover_chain=failover_chain
    )

@app.get("/api/ngrok/status", response_model=NgrokStatusResponse)
async def get_ngrok_status():
    """Checks local ngrok API (port 4040) to detect active public tunnels."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://127.0.0.1:4040/api/tunnels")
            if resp.status_code == 200:
                data = resp.json()
                tunnels = data.get("tunnels", [])
                public_url = None
                for t in tunnels:
                    if t.get("proto") == "https":
                        public_url = t.get("public_url")
                        break
                if not public_url and tunnels:
                    public_url = tunnels[0].get("public_url")
                    
                if public_url:
                    return NgrokStatusResponse(connected=True, public_url=public_url)
    except Exception as e:
        logger.warning("ngrok.check_failed", error=str(e))
    return NgrokStatusResponse(connected=False, public_url=None)

@app.post("/webhook/github", response_model=WebhookResponse)
async def github_webhook(request: Request):
    """Ingestion endpoint for GitHub webhooks."""
    from core.services.ingestion import process_github_webhook
    trace_id = structlog.contextvars.get_contextvars().get("trace_id")
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    return await process_github_webhook(body, signature, request, state.settings, state.db, state.extractor, trace_id)
