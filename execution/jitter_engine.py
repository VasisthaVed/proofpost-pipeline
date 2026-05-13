"""Jitter and exponential backoff engine.

This module provides utilities for introducing randomized delays and 
calculating exponential backoff intervals to prevent thundering herds 
and handle rate limits gracefully.
"""

import asyncio
import random
import structlog
from typing import Optional

logger = structlog.get_logger()

class JitterEngine:
    """Engine for calculating and executing randomized delays."""

    def __init__(
        self, 
        default_min: float = 45.0, 
        default_max: float = 120.0
    ):
        """Initializes the jitter engine with default ranges.
        
        Args:
            default_min: Minimum seconds for jitter delay.
            default_max: Maximum seconds for jitter delay.
        """
        self.default_min = default_min
        self.default_max = default_max

    def calculate_jitter(
        self, 
        min_seconds: Optional[float] = None, 
        max_seconds: Optional[float] = None
    ) -> float:
        """Calculates a random delay within a range.
        
        Args:
            min_seconds: Minimum delay (defaults to engine default).
            max_seconds: Maximum delay (defaults to engine default).
            
        Returns:
            A random float between min and max.
        """
        low = min_seconds if min_seconds is not None else self.default_min
        high = max_seconds if max_seconds is not None else self.default_max
        return random.uniform(low, high)

    def calculate_backoff(
        self, 
        attempt: int, 
        base_delay: float = 2.0, 
        max_delay: float = 300.0,
        add_jitter: bool = True
    ) -> float:
        """Calculates exponential backoff delay.
        
        Formula: base_delay * (2 ^ (attempt - 1))
        
        Args:
            attempt: The current retry attempt (1-indexed).
            base_delay: The starting delay in seconds.
            max_delay: Maximum allowed delay.
            add_jitter: Whether to add a small random jitter to the backoff.
            
        Returns:
            Delay in seconds.
        """
        if attempt <= 0:
            return 0.0
            
        delay = base_delay * (2 ** (attempt - 1))
        delay = min(delay, max_delay)
        
        if add_jitter:
            # Full jitter: random between 0 and delay
            delay = random.uniform(0, delay)
            
        return delay

    async def wait_jitter(
        self, 
        min_seconds: Optional[float] = None, 
        max_seconds: Optional[float] = None
    ):
        """Asynchronously sleeps for a randomized duration.
        
        Args:
            min_seconds: Minimum delay.
            max_seconds: Maximum delay.
        """
        delay = self.calculate_jitter(min_seconds, max_seconds)
        logger.debug("jitter.waiting", duration=delay)
        await asyncio.sleep(delay)

    async def wait_backoff(
        self, 
        attempt: int, 
        base_delay: float = 2.0, 
        max_delay: float = 300.0
    ):
        """Asynchronously sleeps for an exponential backoff duration.
        
        Args:
            attempt: Current retry attempt.
            base_delay: Starting delay.
            max_delay: Maximum delay.
        """
        delay = self.calculate_backoff(attempt, base_delay, max_delay)
        logger.info("jitter.backoff_waiting", attempt=attempt, duration=delay)
        await asyncio.sleep(delay)
