"""HMAC signature verification for incoming webhook payloads.

This module verifies that incoming requests are properly signed
with the expected HMAC signature to ensure authenticity and 
implements replay protection based on request age.
"""

import hmac
import hashlib
import time
import structlog
from typing import Optional

logger = structlog.get_logger()

def verify_signature(
    payload: bytes, 
    signature_header: str, 
    secret: str, 
    timestamp: Optional[float] = None
) -> bool:
    """Verifies the HMAC-SHA256 signature and checks the request age.
    
    Args:
        payload: The raw request body as bytes.
        signature_header: The value of the X-Hub-Signature-256 header.
        secret: The shared secret used for HMAC.
        timestamp: The epoch timestamp of the request (e.g., from Date header).
                  If None, age check is skipped.
                  
    Returns:
        True if signature is valid and request is fresh (<= 5 min), False otherwise.
    """
    if not signature_header or not secret:
        logger.warning("hmac.missing_credentials")
        return False

    # 1. Verify Replay Protection (Age Check)
    if timestamp is not None:
        current_time = time.time()
        age_seconds = current_time - timestamp
        
        # 5 minutes = 300 seconds
        if abs(age_seconds) > 300:
            logger.warning("hmac.request_too_old", age=age_seconds)
            return False

    # 2. Verify HMAC Signature
    if not signature_header.startswith("sha256="):
        logger.warning("hmac.invalid_header_format")
        return False

    actual_signature = signature_header.split("sha256=")[-1]
    
    try:
        expected_signature = hmac.new(
            secret.encode("utf-8"), 
            payload, 
            hashlib.sha256
        ).hexdigest()
        
        if hmac.compare_digest(expected_signature, actual_signature):
            logger.info("hmac.verified")
            return True
        else:
            logger.warning("hmac.verification_failed")
            return False
            
    except Exception as e:
        logger.error("hmac.error", error=str(e))
        return False