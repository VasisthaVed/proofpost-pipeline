"""Retry logic for failed publishing attempts.

This module provides standalone async retry helpers for transient
failures in platform API calls, allowing exponential backoff with jitter.
"""

import asyncio
import structlog
from typing import Callable, TypeVar, Any, Awaitable
from functools import wraps
from execution.jitter_engine import JitterEngine

logger = structlog.get_logger()

T = TypeVar('T')

async def retry_with_backoff(
    operation: Callable[..., Awaitable[T]],
    max_retries: int,
    jitter_engine: JitterEngine,
    *args: Any,
    **kwargs: Any
) -> T:
    """Executes an async operation with exponential backoff on failure.
    
    Args:
        operation: Async function to execute.
        max_retries: Maximum number of retry attempts.
        jitter_engine: Engine used to calculate backoff delays.
        *args, **kwargs: Arguments passed to the operation.
        
    Returns:
        The result of the operation if successful.
        
    Raises:
        Exception: The last exception encountered if all retries fail.
    """
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return await operation(*args, **kwargs)
        except Exception as e:
            last_error = e
            logger.warning("retry.attempt_failed", attempt=attempt, error=str(e))
            if attempt < max_retries:
                await jitter_engine.wait_backoff(attempt)
                
    if last_error:
        raise last_error
    raise RuntimeError("Retry loop exited without returning or raising.")