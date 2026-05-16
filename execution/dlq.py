"""Dead Letter Queue (DLQ) management.

This module handles the persistence of facts that have failed all 
retry attempts, ensuring no data is lost even on permanent failures.
"""

import structlog
from typing import Optional
from core.database import Database
from core.models import VerifiedBuildFact

logger = structlog.get_logger()

class DeadLetterQueue:
    """Handles persistence of permanently failed dispatch attempts."""

    def __init__(self, db: Database):
        """Initializes the DLQ with a database handler.
        
        Args:
            db: Instance of the centralized Database handler.
        """
        self.db = db

    async def store(
        self, 
        fact: VerifiedBuildFact, 
        last_error: Optional[str] = None
    ):
        """Moves a failed fact from the active queue to the DLQ table.
        
        Args:
            fact: The VerifiedBuildFact that failed.
            last_error: The final error message encountered.
        """
        try:
            await self.db.move_fact_to_dlq(fact.id, fact.model_dump_json(), last_error)
            logger.error(
                "dlq.stored", 
                fact_id=fact.id, 
                error=last_error
            )
        except Exception as e:
            logger.critical("dlq.storage_failed", fact_id=fact.id, error=str(e))
            raise