"""Request size limiting middleware.

This module enforces maximum payload size limits to prevent
denial-of-service attacks and manage resource consumption.
"""

import structlog

logger = structlog.get_logger()

def check_size(payload_bytes: bytes, max_kb: int = 512) -> bool:
    """Checks if the payload size is within the allowed limit.
    
    Args:
        payload_bytes: The raw request body as bytes.
        max_kb: The maximum allowed size in kilobytes (default 512).
        
    Returns:
        True if size is <= limit, False otherwise.
    """
    if payload_bytes is None:
        logger.warning("size_limiter.null_payload")
        return False

    size_bytes = len(payload_bytes)
    max_bytes = max_kb * 1024
    
    if size_bytes > max_bytes:
        logger.warning(
            "size_limiter.limit_exceeded", 
            size=size_bytes, 
            limit=max_bytes
        )
        return False
        
    logger.info("size_limiter.pass", size=size_bytes)
    return True