"""Ingestion service for processing incoming webhooks and executing the extraction pipeline."""

import structlog
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import HTTPException
from core.database import Database
from core.config import Settings
from extraction.extractor import Extractor
from schemas.responses import WebhookResponse
from ingestion.deduplicator import compute_hash, is_duplicate
from ingestion.hmac_verifier import verify_signature
from ingestion.size_limiter import check_size
from ingestion.payload_sanitizer import sanitize_payload
from verification.verifier import verify_fact, filter_verified

logger = structlog.get_logger()

class IngestionResult(BaseModel):
    """Pydantic model representing the result of an ingestion operation."""
    status: str
    facts_extracted: int = 0
    facts_verified: int = 0
    trace_id: str
    reason: Optional[str] = None

async def validate_webhook_payload(
    body: bytes,
    signature: Optional[str],
    settings: Settings,
    db: Database,
    trace_id: str
) -> IngestionResult:
    """Validates payload size and HMAC signature."""
    await db.log_event(session_id=trace_id, event_type="webhook_received", status="success", detail=f"Payload {len(body)} bytes")
    
    if not check_size(body, max_kb=settings.ingestion.max_payload_size // 1024):
        await db.log_event(session_id=trace_id, event_type="size_check", status="failed", detail=f"Payload {len(body)} exceeds limit")
        raise HTTPException(status_code=413, detail="Payload too large")
        
    if settings.ingestion.hmac_secret and not verify_signature(body, signature, settings.ingestion.hmac_secret):
        logger.warning("webhook.invalid_signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
    elif settings.dev_mode:
        logger.info("webhook.dev_mode_active_hmac_verified")
        
    return IngestionResult(status="valid", trace_id=trace_id)

async def check_duplicate_and_sanitize(
    payload: Dict[str, Any],
    db: Database,
    trace_id: str
) -> tuple[IngestionResult, Dict[str, Any], str]:
    """Checks deduplication hash and sanitizes payload."""
    payload_hash = compute_hash(payload)
    if await is_duplicate(db, payload_hash):
        logger.info("webhook.duplicate_ignored", hash=payload_hash)
        return IngestionResult(status="ignored", reason="duplicate", trace_id=trace_id), {}, payload_hash
        
    clean_payload = sanitize_payload(payload)
    await db.enqueue_ingestion(trace_id, clean_payload)
    await db.log_event(session_id=trace_id, event_type="ingestion_queued", status="success", detail="Payload persisted to durable pre-extraction queue")
    
    return IngestionResult(status="sanitized", trace_id=trace_id), clean_payload, payload_hash

async def execute_extraction_and_verification(
    clean_payload: Dict[str, Any],
    payload_hash: str,
    extractor: Extractor,
    db: Database,
    trace_id: str
) -> IngestionResult:
    """Executes AI extraction, deterministic verification, and database persistence."""
    extracted_facts = await extractor.extract(clean_payload)
    await db.log_event(session_id=trace_id, event_type="extraction_complete", status="success" if extracted_facts else "info", detail=f"Extracted {len(extracted_facts)} facts")
    
    verified_facts = [verify_fact(fact, clean_payload, trace_id=trace_id) for fact in extracted_facts]
    final_facts = filter_verified(verified_facts, trace_id=trace_id)
    await db.log_event(session_id=trace_id, event_type="verification_complete", status="success", detail=f"Verified {len(final_facts)} facts (from {len(extracted_facts)} total)")
    
    await db.persist_pipeline_result(final_facts, payload_hash)
    await db.complete_ingestion(trace_id)
    await db.log_event(session_id=trace_id, event_type="persisted_to_db", status="success", detail=f"Queued {len(final_facts)} facts for approval")
    
    return IngestionResult(status="accepted", facts_extracted=len(extracted_facts), facts_verified=len(final_facts), trace_id=trace_id)

async def process_github_webhook(
    body: bytes,
    signature: Optional[str],
    request: Any,
    settings: Settings,
    db: Database,
    extractor: Extractor,
    trace_id: str
) -> WebhookResponse:
    """Orchestrates the full webhook ingestion pipeline."""
    await validate_webhook_payload(body, signature, settings, db, trace_id)
    
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
        
    dedup_res, clean_payload, payload_hash = await check_duplicate_and_sanitize(payload, db, trace_id)
    if dedup_res.status == "ignored":
        return WebhookResponse(status="ignored", facts_extracted=0, facts_verified=0, trace_id=trace_id)
        
    result = await execute_extraction_and_verification(clean_payload, payload_hash, extractor, db, trace_id)
    return WebhookResponse(status=result.status, facts_extracted=result.facts_extracted, facts_verified=result.facts_verified, trace_id=trace_id)
