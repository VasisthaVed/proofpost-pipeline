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
        if not self.db._connection:
            await self.db.connect()

        assert self.db._connection is not None
        
        # We perform this in a transaction: insert into dlq, delete from dispatch_queue
        try:
            await self.db._connection.execute("BEGIN TRANSACTION")
            
            # Get existing retry count from dispatch_queue if available
            async with self.db._connection.execute(
                "SELECT retries, created_at FROM dispatch_queue WHERE fact_id = ?", 
                (fact.id,)
            ) as cursor:
                row = await cursor.fetchone()
                retries = row["retries"] if row else 3
                created_at = row["created_at"] if row else fact.created_at.isoformat()

            await self.db._connection.execute(
                """INSERT INTO dlq 
                   (id, fact_id, status, payload, retries, last_error, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (fact.id, fact.id, "failed", fact.model_dump_json(), retries, last_error, created_at)
            )
            
            await self.db._connection.execute(
                "DELETE FROM dispatch_queue WHERE fact_id = ?", (fact.id,)
            )
            
            await self.db._connection.commit()
            
            logger.error(
                "dlq.stored", 
                fact_id=fact.id, 
                error=last_error,
                retries=retries
            )
        except Exception as e:
            if self.db._connection:
                await self.db._connection.rollback()
            logger.critical("dlq.storage_failed", fact_id=fact.id, error=str(e))
            raise