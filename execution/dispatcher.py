"""Platform dispatch orchestration layer.

This module pulls verified facts from the event bus and coordinates their 
publication across all configured platforms with retry logic and DLQ support.
"""

import asyncio
import structlog
from typing import List, Protocol, Optional, Dict, Any
from core.models import VerifiedBuildFact, VerificationStatus
from core.database import Database
from execution.event_bus import EventBus, EventBusShutdownError
from execution.dlq import DeadLetterQueue
from execution.jitter_engine import JitterEngine

logger = structlog.get_logger()

class PlatformAdapter(Protocol):
    """Protocol defining the interface for platform-specific publishers."""
    async def authenticate(self) -> bool: ...
    async def dispatch(self, fact: VerifiedBuildFact) -> Dict[str, Any]: ...

class Dispatcher:
    """Orchestrates fact publication across multiple platforms."""

    def __init__(
        self, 
        event_bus: EventBus, 
        database: Database,
        jitter_engine: JitterEngine,
        adapters: List[PlatformAdapter],
        max_retries: int = 3,
        dry_run: bool = False
    ):
        """Initializes the dispatcher with required collaborators.
        
        Args:
            event_bus: The source of verified facts.
            database: Centralized database handler.
            jitter_engine: Engine for calculating retry delays.
            adapters: List of platform-specific publishers.
            max_retries: Maximum number of retry attempts per fact (default 3).
        """
        self.event_bus = event_bus
        self.db = database
        self.jitter = jitter_engine
        self.adapters = adapters
        self.max_retries = max_retries
        self.dry_run = dry_run
        self.dlq = DeadLetterQueue(database)
        self._running = False

    async def run(self):
        """Starts the main dispatch loop with authoritative crash recovery.
        
        Recovers all 'pending' jobs from SQLite before processing new signals
         from the event bus.
        """
        self._running = True
        logger.info("dispatcher.started", adapter_count=len(self.adapters))
        
        # 1. Authoritative Recovery
        # Load any facts that were persisted to DB but not yet dispatched
        try:
            recoverable_facts = await self.db.get_recoverable_facts()
            if recoverable_facts:
                logger.info("dispatcher.recovery_initiated", count=len(recoverable_facts))
                for fact in recoverable_facts:
                    # We inject recovered facts into the bus for processing
                    # Use a synthetic trace_id for recovery
                    await self.event_bus.enqueue(fact, f"recovery-{fact.id[:8]}")
        except Exception as e:
            logger.error("dispatcher.recovery_failed", error=str(e))

        # 2. Main Processing Loop
        try:
            while self._running:
                try:
                    fact, trace_id = await self.event_bus.dequeue()
                    
                    # Process the fact across all platforms
                    await self._process_fact(fact, trace_id)
                    
                except EventBusShutdownError:
                    logger.info("dispatcher.stopping_bus_empty")
                    break
                except Exception as e:
                    logger.error("dispatcher.loop_error", error=str(e))
                    await asyncio.sleep(1) # Prevent tight error loops
        finally:
            self._running = False
            logger.info("dispatcher.stopped")

    async def _process_fact(self, fact: VerifiedBuildFact, trace_id: str):
        """Handles the multi-platform publication of a single fact.
        
        Args:
            fact: The fact to publish.
            trace_id: Correlation ID for logging.
        """
        log = logger.bind(fact_id=fact.id, trace_id=trace_id)

        # 1. Authoritative DB Check & Lock
        # We must acquire a lock by transitioning to 'dispatching' status.
        # This prevents other dispatcher workers (or concurrent loops) from picking it up.
        if not await self.db.transition_fact_status(fact.id, ["approved", "dispatching"], "dispatching"):
            # Check if it was already dispatched to avoid redundant logs
            result = await self.db.get_fact_with_status(fact.id)
            status = result[1] if result else "unknown"
            if status != "dispatched":
                log.warning("dispatcher.acquisition_failed", current_status=status)
            return

        # 2. Reload latest fact from DB to ensure deployed_to is authoritative
        # The fact in memory might be stale if another worker updated it
        authoritative_result = await self.db.get_fact_with_status(fact.id)
        if not authoritative_result:
            log.error("dispatcher.fact_disappeared")
            return
        fact, _ = authoritative_result

        if self.dry_run:
            platforms = [a.__class__.__name__.replace("Adapter", "").lower() for a in self.adapters]
            log.info("dispatch.dry_run", summary=fact.summary, platforms=platforms)
            fact.deployed_to = list(set(fact.deployed_to + platforms))
            await self.db.update_fact_payload(fact.id, fact.model_dump_json())
            await self.db.update_fact_status(fact.id, "dispatched")
            return

        # 1. Identify which platforms are still pending
        # We check fact.deployed_to to support authoritative recovery after partial success
        pending_adapters = []
        # Normalize existing successes to lower case for reliable comparison
        fact.deployed_to = [p.lower() for p in fact.deployed_to]
        
        for adapter in self.adapters:
            name = type(adapter).__name__.replace("Adapter", "").lower()
            # Added dispatch retry protection: Skip platforms that already succeeded
            if name in fact.deployed_to:
                continue
            pending_adapters.append(adapter)

        if not pending_adapters:
            log.info("dispatcher.already_fully_dispatched", platforms=fact.deployed_to)
            await self.db.update_fact_status(fact.id, "dispatched")
            return

        success = False
        last_error = None
        
        # 2. Incremental Dispatch Loop
        for attempt in range(1, self.max_retries + 1):
            try:
                # Dispatch only to pending platforms in parallel
                results = await asyncio.gather(
                    *(adapter.dispatch(fact) for adapter in pending_adapters),
                    return_exceptions=True
                )
                
                # Process results and update state
                still_pending = []
                new_successes = []
                
                for i, result in enumerate(results):
                    adapter = pending_adapters[i]
                    name = type(adapter).__name__.replace("Adapter", "")
                    
                    if isinstance(result, dict) and result.get("success") is True:
                        new_successes.append(name.lower())
                        log.info("dispatcher.adapter_success", adapter=name, attempt=attempt)
                    else:
                        still_pending.append(adapter)
                        error_msg = str(result) if isinstance(result, Exception) else f"Return value: {result}"
                        log.warning("dispatcher.adapter_failed", adapter=name, attempt=attempt, error=error_msg)
                        last_error = error_msg

                # Authoritative state update: Persist successes immediately
                if new_successes:
                    fact.deployed_to.extend(new_successes)
                    await self.db.update_fact_payload(fact.id, fact.model_dump_json())
                    log.info("dispatcher.state_persisted", new_platforms=new_successes)
                
                pending_adapters = still_pending
                
                if not pending_adapters:
                    success = True
                    break
                
            except Exception as e:
                last_error = str(e)
                log.warning("dispatcher.attempt_failed", attempt=attempt, error=last_error)

            if attempt < self.max_retries:
                # Calculate and wait for backoff
                await self.jitter.wait_backoff(attempt)

        # 3. Final Status Update
        if success:
            await self.db.update_fact_status(fact.id, "dispatched")
            await self.db.log_event(
                session_id=trace_id,
                event_type="dispatched",
                status="success",
                detail=f"Successfully published to: {', '.join(fact.deployed_to)}",
                fact_id=fact.id
            )
            log.info("dispatcher.fact_published_successfully", total_platforms=fact.deployed_to)
        else:
            await self.db.update_fact_status(fact.id, "failed", error=last_error)
            await self.dlq.store(fact, last_error=last_error)
            await self.db.log_event(
                session_id=trace_id,
                event_type="dispatch_failed",
                status="failed",
                detail=f"Dispatch failed: {last_error}",
                fact_id=fact.id
            )
            log.error("dispatcher.fact_moved_to_dlq", error=last_error)