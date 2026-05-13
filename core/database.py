"""Database connection and CRUD operations for ProofPost.

This module manages the SQLite database connection, table schemas,
and basic database operations using aiosqlite.
"""

import aiosqlite
import json
import structlog
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
from core.models import VerifiedBuildFact

logger = structlog.get_logger()

class Database:
    """Handles all SQLite database operations for the pipeline."""

    def __init__(self, db_url: str):
        """Initializes the database handler.
        
        Args:
            db_url: SQLite connection string (e.g., 'sqlite:///proofpost.db')
        """
        # Strip sqlite:/// prefix for aiosqlite
        self.db_path = db_url.replace("sqlite:///", "")
        self._connection: Optional[aiosqlite.Connection] = None

    @property
    def is_connected(self) -> bool:
        """Returns True if the database is connected."""
        return self._connection is not None

    async def connect(self) -> None:
        """Establishes a connection to the database."""
        if not self._connection:
            self._connection = await aiosqlite.connect(self.db_path)
            # Enable dictionary-like rows
            self._connection.row_factory = aiosqlite.Row
            # Enable WAL mode for concurrent async access
            await self._connection.execute("PRAGMA journal_mode=WAL;")
            logger.info("database.connected", path=self.db_path)

    async def disconnect(self) -> None:
        """Closes the database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.info("database.disconnected")

    async def initialize(self) -> None:
        """Creates the necessary tables if they do not exist.
        
        Tables created:
        - dispatch_queue: Stores facts pending publication.
        - dlq: Dead Letter Queue for failed publications.
        - idempotency: Stores hashes of processed payloads.
        """
        if not self._connection:
            await self.connect()

        assert self._connection is not None
        
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS dispatch_queue (
                id TEXT PRIMARY KEY,
                fact_id TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                retries INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS dlq (
                id TEXT PRIMARY KEY,
                fact_id TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                retries INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        await self._connection.execute("""
            CREATE TABLE IF NOT EXISTS idempotency (
                hash TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
        """)
        
        await self._connection.commit()
        logger.info("database.initialized")

    async def add_to_idempotency(self, payload_hash: str) -> None:
        """Stores a payload hash to prevent double processing.
        
        Args:
            payload_hash: SHA-256 hash of the payload.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        now = datetime.now(timezone.utc).isoformat()
        try:
            await self._connection.execute(
                "INSERT INTO idempotency (hash, created_at) VALUES (?, ?)",
                (payload_hash, now)
            )
            await self._connection.commit()
        except aiosqlite.IntegrityError:
            logger.warning("database.idempotency_collision", hash=payload_hash)
            raise

    async def is_duplicate(self, payload_hash: str) -> bool:
        """Checks if a payload hash has already been processed.
        
        Args:
            payload_hash: SHA-256 hash to check.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT hash FROM idempotency WHERE hash = ?", (payload_hash,)
        ) as cursor:
            row = await cursor.fetchone()
            return row is not None

    async def enqueue_fact(self, fact: VerifiedBuildFact) -> None:
        """Adds a fact to the dispatch queue.
        
        Args:
            fact: The VerifiedBuildFact to enqueue.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        now = datetime.now(timezone.utc).isoformat()
        await self._connection.execute(
            """INSERT INTO dispatch_queue 
               (id, fact_id, status, payload, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            (fact.id, fact.id, "pending", fact.model_dump_json(), now, now)
        )
        await self._connection.commit()
        logger.info("database.fact_enqueued", fact_id=fact.id)

    async def get_pending_facts(self) -> List[VerifiedBuildFact]:
        """Retrieves all facts with 'pending' status.
        
        Returns:
            List of VerifiedBuildFact objects.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT payload FROM dispatch_queue WHERE status = 'pending'"
        ) as cursor:
            rows = await cursor.fetchall()
            return [VerifiedBuildFact.model_validate_json(row["payload"]) for row in rows]

    async def get_recoverable_facts(self) -> List[VerifiedBuildFact]:
        """Retrieves all facts that should be re-enqueued on startup.
        
        This includes 'approved' (confirmed by operator but not yet dispatched)
        and 'dispatching' (interrupted during publication) facts.
        
        Returns:
            List of VerifiedBuildFact objects.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT payload FROM dispatch_queue WHERE status IN ('approved', 'dispatching')"
        ) as cursor:
            rows = await cursor.fetchall()
            return [VerifiedBuildFact.model_validate_json(row["payload"]) for row in rows]

    async def persist_pipeline_result(self, facts: List[VerifiedBuildFact], payload_hash: str) -> None:
        """Atomically persists verified facts and marks the payload as processed.
        
        This ensures that if the process crashes after this call, the facts are
        authoritatively queued in the database and will not be re-processed
        due to the idempotency mark.
        
        Args:
            facts: List of VerifiedBuildFact objects to enqueue.
            payload_hash: SHA-256 hash of the source payload.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        now = datetime.now(timezone.utc).isoformat()
        
        try:
            await self._connection.execute("BEGIN TRANSACTION")
            
            # 1. Persist Facts
            for fact in facts:
                await self._connection.execute(
                    """INSERT INTO dispatch_queue 
                       (id, fact_id, status, payload, created_at, updated_at) 
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (fact.id, fact.id, "pending", fact.model_dump_json(), now, now)
                )
            
            # 2. Mark Idempotency
            await self._connection.execute(
                "INSERT INTO idempotency (hash, created_at) VALUES (?, ?)",
                (payload_hash, now)
            )
            
            await self._connection.commit()
            logger.info("database.pipeline_result_persisted", fact_count=len(facts), hash=payload_hash)
            
        except Exception as e:
            if self._connection:
                await self._connection.rollback()
            logger.error("database.persistence_failed", error=str(e), hash=payload_hash)
            raise

    async def update_fact_status(self, fact_id: str, status: str, error: Optional[str] = None) -> None:
        """Updates the status of a fact in the queue.
        
        Args:
            fact_id: ID of the fact to update.
            status: New status ('pending', 'approved', 'dispatching', 'dispatched', 'failed').
            error: Optional error message if status is 'failed'.
        """
        if not self._connection:
            await self.connect()
            
        assert self._connection is not None
        
        now = datetime.now(timezone.utc).isoformat()
        if status == "failed":
            await self._connection.execute(
                """UPDATE dispatch_queue 
                   SET status = ?, last_error = ?, retries = retries + 1, updated_at = ?
                   WHERE id = ?""",
                (status, error, now, fact_id)
            )
        else:
            await self._connection.execute(
                """UPDATE dispatch_queue 
                   SET status = ?, updated_at = ?
                   WHERE id = ?""",
                (status, now, fact_id)
            )
        await self._connection.commit()
        logger.info("database.fact_status_updated", fact_id=fact_id, status=status)

    async def transition_fact_status(self, fact_id: str, from_status: List[str], to_status: str) -> bool:
        """Atomically transitions a fact from one of several statuses to another.
        
        Returns:
            True if transition was successful, False otherwise.
        """
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        placeholders = ",".join(["?"] * len(from_status))
        query = f"""UPDATE dispatch_queue 
                   SET status = ?, updated_at = ?
                   WHERE id = ? AND status IN ({placeholders})"""
        
        now = datetime.now(timezone.utc).isoformat()
        params = [to_status, now, fact_id] + from_status
        
        cursor = await self._connection.execute(query, params)
        await self._connection.commit()
        
        success = cursor.rowcount > 0
        if success:
            logger.info("database.fact_status_transitioned", fact_id=fact_id, from_status=from_status, to_status=to_status)
        return success

    async def get_queue_stats(self) -> Dict[str, int]:
        """Returns statistics about the dispatch queue."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        pending_count = 0
        dispatched_count = 0
        
        async with self._connection.execute(
            "SELECT count(*) as count FROM dispatch_queue WHERE status = 'pending'"
        ) as cursor:
            row = await cursor.fetchone()
            pending_count = row["count"] if row else 0
            
        async with self._connection.execute(
            "SELECT count(*) as count FROM dispatch_queue WHERE status = 'dispatched'"
        ) as cursor:
            row = await cursor.fetchone()
            dispatched_count = row["count"] if row else 0
            
        return {"pending": pending_count, "dispatched": dispatched_count}

    async def get_fact_with_status(self, fact_id: str) -> Optional[tuple[VerifiedBuildFact, str]]:
        """Retrieves a single fact and its status by ID."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT payload, status FROM dispatch_queue WHERE id = ?", (fact_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            fact = VerifiedBuildFact.model_validate_json(row["payload"])
            return fact, row["status"]

    async def get_fact_by_id(self, fact_id: str) -> Optional[VerifiedBuildFact]:
        """Retrieves a single fact by its ID."""
        result = await self.get_fact_with_status(fact_id)
        return result[0] if result else None

    async def update_fact_payload(self, fact_id: str, payload: str) -> None:
        """Updates the payload of a fact."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        now = datetime.now(timezone.utc).isoformat()
        await self._connection.execute(
            "UPDATE dispatch_queue SET payload = ?, updated_at = ? WHERE id = ?",
            (payload, now, fact_id)
        )
        await self._connection.commit()
        logger.info("database.fact_payload_updated", fact_id=fact_id)

    async def get_history(self) -> List[Dict[str, Any]]:
        """Returns the history of dispatched and failed posts."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT id, created_at, updated_at, payload, status FROM dispatch_queue WHERE status IN ('dispatched', 'failed') ORDER BY updated_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            items = []
            for row in rows:
                fact = VerifiedBuildFact.model_validate_json(row["payload"])
                platform = ", ".join(fact.deployed_to) if fact.deployed_to else "Unknown"
                
                # Use updated_at for dispatched items to show when they actually went out (BUG-B8)
                display_time = row["updated_at"] if row["status"] == "dispatched" else row["created_at"]
                
                items.append({
                    "id": row["id"],
                    "created_at": display_time,
                    "platform": platform,
                    "summary": fact.summary,
                    "status": row["status"],
                    "url": None 
                })
            return items