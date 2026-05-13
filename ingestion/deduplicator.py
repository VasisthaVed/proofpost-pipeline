"""Event deduplication logic.

This module prevents duplicate processing of the same event
by tracking hashes of processed payloads in the database.
"""

import hashlib
import json
import structlog
from typing import Dict, Any
from core.database import Database

logger = structlog.get_logger()

def compute_hash(payload: Dict[str, Any]) -> str:
    """Computes a deterministic SHA-256 hash of a dictionary.
    
    Args:
        payload: The dictionary to hash.
        
    Returns:
        Hex string of the SHA-256 hash.
    """
    # Use sort_keys=True for determinism
    encoded_payload = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded_payload).hexdigest()

async def is_duplicate(db: Database, payload_hash: str) -> bool:
    """Checks if the given hash has already been processed.
    
    Args:
        db: The database instance to use.
        payload_hash: The hash to check.
        
    Returns:
        True if already seen, False otherwise.
    """
    try:
        return await db.is_duplicate(payload_hash)
    except Exception as e:
        logger.error("deduplicator.check_failed", error=str(e), hash=payload_hash)
        # Fail safe: assume not a duplicate if DB fails? 
        # Actually, in security contexts, we might want to fail closed, 
        # but for deduplication, failing open is usually preferred to avoid data loss.
        return False

async def mark_seen(db: Database, payload_hash: str) -> None:
    """Marks a hash as seen in the database.
    
    Args:
        db: The database instance to use.
        payload_hash: The hash to store.
    """
    try:
        await db.add_to_idempotency(payload_hash)
        logger.info("deduplicator.marked_seen", hash=payload_hash)
    except Exception as e:
        logger.error("deduplicator.mark_failed", error=str(e), hash=payload_hash)
        # We don't raise here as per the "no exceptions to caller" pattern observed elsewhere,
        # but we log the failure.