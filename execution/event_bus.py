"""Asynchronous event bus for fact transport.

This module provides a bounded, async-safe queue for transporting 
VerifiedBuildFact objects from the verification layer to the execution layer.
"""

import asyncio
import structlog
from typing import Optional, Tuple
from core.models import VerifiedBuildFact

logger = structlog.get_logger()

class EventBusShutdownError(Exception):
    """Raised when an operation is attempted on a closed event bus."""
    pass

class EventBus:
    """Bounded asyncio.Queue-backed event transport.
    
    Ensures deterministic ordering and trace_id propagation across
    pipeline boundaries.
    """

    def __init__(self, max_size: int = 100):
        """Initializes the event bus with a maximum queue size.
        
        Args:
            max_size: Maximum number of events allowed in the queue.
        """
        self._queue: asyncio.Queue[Optional[Tuple[VerifiedBuildFact, str]]] = asyncio.Queue(maxsize=max_size)
        self._shutdown_event = asyncio.Event()
        self._max_size = max_size
        
        logger.info("event_bus.initialized", max_size=max_size)

    async def enqueue(self, event: VerifiedBuildFact, trace_id: str):
        """Asynchronously enqueues a verified fact with its trace_id.
        
        Args:
            event: The VerifiedBuildFact to transport.
            trace_id: Correlation ID for request tracing.
            
        Raises:
            EventBusShutdownError: If the bus has been shut down.
        """
        if self._shutdown_event.is_set():
            logger.error("event_bus.enqueue_failed_shutdown", fact_id=event.id, trace_id=trace_id)
            raise EventBusShutdownError("Cannot enqueue to a closed event bus.")

        await self._queue.put((event, trace_id))
        
        logger.info(
            "event_bus.enqueued", 
            fact_id=event.id, 
            trace_id=trace_id, 
            queue_size=self.size()
        )

    async def dequeue(self) -> Tuple[VerifiedBuildFact, str]:
        """Asynchronously retrieves the next fact and trace_id from the bus.
        
        Returns:
            A tuple of (VerifiedBuildFact, trace_id).
            
        Raises:
            EventBusShutdownError: If the bus is shut down and empty.
        """
        # If queue is empty and shutdown was called, return immediately
        if self._queue.empty() and self._shutdown_event.is_set():
            raise EventBusShutdownError("Event bus is closed and empty.")

        item = await self._queue.get()
        
        if item is None:
            # Re-enqueue the sentinel for other consumers and raise
            await self._queue.put(None)
            logger.debug("event_bus.dequeue_sentinel_reached")
            raise EventBusShutdownError("Event bus has been shut down.")

        fact, trace_id = item
        
        logger.info(
            "event_bus.dequeued", 
            fact_id=fact.id, 
            trace_id=trace_id, 
            queue_size=self.size()
        )
        
        return fact, trace_id

    def size(self) -> int:
        """Returns the current number of items in the queue.
        
        Note: This includes the shutdown sentinel if enqueued.
        """
        return self._queue.qsize()

    async def shutdown(self):
        """Gracefully shuts down the event bus.
        
        Signals producers to stop enqueuing and places a sentinel value 
        in the queue to notify consumers.
        """
        if self._shutdown_event.is_set():
            return

        self._shutdown_event.set()
        
        # Enqueue None as a sentinel to signal consumers to stop
        # We use await here to ensure it gets in even if queue is full
        # (though typically shutdown happens after producers stop)
        await self._queue.put(None)
        
        logger.info("event_bus.shutdown_initiated", queue_size=self.size())
