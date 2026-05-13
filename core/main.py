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
from fastapi.responses import FileResponse
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
    SettingsResponse, IngestionSettingsResponse, PlatformSettingsResponse
)
from pydantic import BaseModel
import json
from datetime import datetime, timezone

logger = structlog.get_logger()

class ApprovalRequest(BaseModel):
    """Request body for fact approval, allowing optional content overrides."""
    summary: Optional[str] = None

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

# --- Static Files ---
app.mount("/static", StaticFiles(directory="ui"), name="static")

# --- Routes ---

@app.get("/")
async def serve_ui():
    """Serves the main dashboard UI."""
    return FileResponse("ui/index.html")

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

    # 3. Atomic Status Transition
    # Prevent duplicate approval dispatch
    # We atomically move from 'pending' to 'approved'. If this fails, it means
    # the fact was already approved or is being dispatched.
    if not await state.db.transition_fact_status(fact_id, ["pending"], "approved"):
        logger.warning("approve_fact.ignored", fact_id=fact_id, current_status=current_status)
        return {"status": "ignored", "message": f"Fact already in status: {current_status}", "id": fact_id}

    # 4. Persist overrides and Signal Dispatcher
    fact.approved = True
    fact.approved_at = datetime.now(timezone.utc)
    await state.db.update_fact_payload(fact_id, fact.model_dump_json())
    await state.bus.enqueue(fact, trace_id)
    
    return {"status": "success", "message": "Fact approved for publication", "id": fact_id}

@app.post("/api/facts/{fact_id}/reject", response_model=ActionResponse)
async def reject_fact(fact_id: str):
    """Rejects a fact, preventing it from being published."""
    await state.db.update_fact_status(fact_id, "rejected")
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
    platforms = [
        PlatformStatus(
            id="linkedin", 
            name="LinkedIn", 
            connected=bool(s.linkedin.enabled and s.linkedin.access_token),
            last_tested=None,
            last_error=None
        ),
        PlatformStatus(
            id="bluesky", 
            name="Bluesky", 
            connected=bool(s.bluesky.enabled and s.bluesky.handle and s.bluesky.app_password),
            last_tested=None,
            last_error=None
        )
    ]
    return {"platforms": platforms}

@app.post("/api/platforms/{platform_id}/test", response_model=TestPlatformResponse)
async def test_platform(platform_id: str):
    """Triggers a connection test for a specific platform adapter."""
    # Find adapter in state.dispatcher.adapters
    # For now, we only have one adapter in the list
    adapter = None
    if platform_id == "linkedin":
        for a in state.dispatcher.adapters:
            if isinstance(a, LinkedInAdapter):
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
        if not val: return ""
        return "****"

    return {
        "ingestion": {
            "hmac_secret": mask(s.ingestion.hmac_secret),
            "max_payload_size": s.ingestion.max_payload_size
        },
        "ai": {
            "provider": s.ai.provider,
            "api_key": mask(s.ai.api_key),
            "model": s.ai.model
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
        "dev_mode": s.dev_mode,
        "dry_run": s.dry_run
    }

@app.post("/api/settings", response_model=ActionResponse)
async def save_settings(payload: Dict[str, Any]):
    """Saves updated settings and dynamically re-initializes platform adapters."""
    try:
        # 1. Handle masked values and merge with current state
        def unmask(new_val, old_val):
            if new_val == "****":
                return old_val
            return new_val or ""

        # Ingestion
        if "ingestion" in payload:
            if "hmac_secret" in payload["ingestion"]:
                payload["ingestion"]["hmac_secret"] = unmask(
                    payload["ingestion"]["hmac_secret"], 
                    state.settings.ingestion.hmac_secret
                )
            # Preserve max_payload_size if not sent
            if "max_payload_size" not in payload["ingestion"]:
                payload["ingestion"]["max_payload_size"] = state.settings.ingestion.max_payload_size
        else:
            payload["ingestion"] = state.settings.ingestion.model_dump()

        # AI
        if "ai" in payload:
            if "api_key" in payload["ai"]:
                payload["ai"]["api_key"] = unmask(
                    payload["ai"]["api_key"], 
                    state.settings.ai.api_key
                )
        else:
            payload["ai"] = state.settings.ai.model_dump()

        # Platforms
        if "platforms" in payload:
            p = payload["platforms"]
            # Bluesky
            if "bluesky" in p:
                b = p["bluesky"]
                if "app_password" in b:
                    b["app_password"] = unmask(
                        b.get("app_password"), 
                        state.settings.platforms.bluesky.app_password
                    )
            # LinkedIn
            if "linkedin" in p:
                l = p["linkedin"]
                if "access_token" in l:
                    l["access_token"] = unmask(
                        l.get("access_token"), 
                        state.settings.platforms.linkedin.access_token
                    )
        else:
            payload["platforms"] = state.settings.platforms.model_dump()

        # Database (Always preserve)
        payload["database"] = state.settings.database.model_dump()

        # 2. Update live state and persist
        updated_settings = Settings(**payload)
        
        from pathlib import Path
        settings_path = Path(__file__).parent.parent / "settings.json"
        with open(settings_path, "w") as f:
            json.dump(updated_settings.model_dump(mode='json'), f, indent=2)
            
        # 3. Reload from file to ensure consistency
        state.settings = load_config(str(settings_path))
            
        # 4. Dynamic Re-initialization
        new_adapters: List[PlatformAdapter] = []
        s = state.settings.platforms
        
        if s.linkedin.enabled and s.linkedin.access_token:
            linkedin = LinkedInAdapter(
                access_token=s.linkedin.access_token,
                author_urn="urn:li:person:me"
            )
            new_adapters.append(linkedin)
            
        if s.bluesky.enabled and s.bluesky.handle and s.bluesky.app_password:
            from platforms.bluesky import BlueskyAdapter
            new_adapters.append(BlueskyAdapter(
                handle=s.bluesky.handle,
                app_password=s.bluesky.app_password
            ))
        
        state.dispatcher.adapters = new_adapters
        state.dispatcher.dry_run = state.settings.dry_run
        
        logger.info("settings.saved_successfully", adapter_count=len(new_adapters))
        return {"status": "saved", "message": "Settings saved and reloaded"}
    except Exception as e:
        logger.error("settings.save_failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/webhook/github")
async def github_webhook(request: Request):
    """Ingestion endpoint for GitHub webhooks."""
    trace_id = structlog.contextvars.get_contextvars().get("trace_id")
    
    # 1. Size Check
    body = await request.body()
    if not check_size(body, max_kb=state.settings.ingestion.max_payload_size // 1024):
        raise HTTPException(status_code=413, detail="Payload too large")
    
    # 2. Signature Check
    signature = request.headers.get("X-Hub-Signature-256")
    if state.settings.dev_mode:
        logger.info("webhook.dev_mode_skip_hmac")
    elif not verify_signature(body, signature, state.settings.ingestion.hmac_secret):
        logger.warning("webhook.invalid_signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    # 3. JSON Parsing
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # 4. Deduplication
    payload_hash = compute_hash(payload)
    if await is_duplicate(state.db, payload_hash):
        logger.info("webhook.duplicate_ignored", hash=payload_hash)
        return {"status": "ignored", "reason": "duplicate"}
    
    # 5. Sanitization
    clean_payload = sanitize_payload(payload)
    
    # 6. Extraction (LLM)
    extracted_facts = await state.extractor.extract(clean_payload)
    
    # 7. Verification (Deterministic)
    verified_facts = []
    for fact in extracted_facts:
        verified_facts.append(verify_fact(fact, clean_payload, trace_id=trace_id))
    
    # 8. Filtering
    final_facts = filter_verified(verified_facts, trace_id=trace_id)
    
    # Enforce mandatory Human-In-The-Loop publishing gate
    # We DO NOT enqueue to EventBus here. Operator must approve via dashboard.
    await state.db.persist_pipeline_result(final_facts, payload_hash)
    
    return {
        "status": "accepted", 
        "facts_extracted": len(extracted_facts),
        "facts_verified": len(final_facts),
        "trace_id": trace_id
    }
