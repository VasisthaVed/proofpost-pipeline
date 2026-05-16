"""Database connection and CRUD operations for ProofPost.

This module manages the SQLite database connection, table schemas,
and basic database operations using aiosqlite.
"""

import aiosqlite
import json
import structlog
import uuid
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
        - pipeline_events: Stores observability logs.
        - ingestion_queue: Stores durable webhook payloads.
        """
        if not self._connection:
            await self.connect()

        assert self._connection is not None
        
        cursor = await self._connection.execute("PRAGMA user_version;")
        row = await cursor.fetchone()
        current_version = row[0] if row else 0

        if current_version < 1:
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

            await self._connection.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_events (
                    id          TEXT PRIMARY KEY,
                    session_id  TEXT NOT NULL,
                    event_type  TEXT NOT NULL,
                    timestamp   TEXT NOT NULL,
                    status      TEXT NOT NULL,
                    detail      TEXT,
                    duration_ms INTEGER,
                    fact_id     TEXT
                )
            """)
            
            await self._connection.execute("""
                CREATE TABLE IF NOT EXISTS ingestion_queue (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            
            await self._connection.execute("PRAGMA user_version = 1;")
            await self._connection.commit()
            logger.info("database.migration_applied", old_version=0, new_version=1)
        
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

    async def enqueue_ingestion(self, trace_id: str, clean_payload: Dict[str, Any]) -> None:
        """Adds a webhook payload to the durable pre-extraction ingestion queue."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        now = datetime.now(timezone.utc).isoformat()
        await self._connection.execute(
            """INSERT INTO ingestion_queue 
               (id, status, payload, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?)""",
            (trace_id, "pre_extraction", json.dumps(clean_payload), now, now)
        )
        await self._connection.commit()
        logger.info("database.ingestion_enqueued", trace_id=trace_id)

    async def complete_ingestion(self, trace_id: str) -> None:
        """Marks an ingestion queue item as successfully extracted."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        now = datetime.now(timezone.utc).isoformat()
        await self._connection.execute(
            """UPDATE ingestion_queue SET status = 'extracted', updated_at = ? WHERE id = ?""",
            (now, trace_id)
        )
        await self._connection.commit()
        logger.info("database.ingestion_completed", trace_id=trace_id)

    async def get_pre_extraction_items(self) -> List[tuple[str, Dict[str, Any]]]:
        """Retrieves all pending pre-extraction webhook payloads."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        async with self._connection.execute(
            "SELECT id, payload FROM ingestion_queue WHERE status = 'pre_extraction'"
        ) as cursor:
            rows = await cursor.fetchall()
            return [(row["id"], json.loads(row["payload"])) for row in rows]

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

    async def transition_and_update_fact(self, fact_id: str, from_status: List[str], to_status: str, payload: str) -> bool:
        """Atomically transitions a fact from one of several statuses to another, and updates its payload."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        placeholders = ",".join(["?"] * len(from_status))
        query = f"""UPDATE dispatch_queue 
                   SET status = ?, payload = ?, updated_at = ?
                   WHERE id = ? AND status IN ({placeholders})"""
        
        now = datetime.now(timezone.utc).isoformat()
        params = [to_status, payload, now, fact_id] + from_status
        
        cursor = await self._connection.execute(query, params)
        await self._connection.commit()
        
        success = cursor.rowcount > 0
        if success:
            logger.info("database.fact_status_payload_transitioned", fact_id=fact_id, to_status=to_status)
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

    async def move_fact_to_dlq(self, fact_id: str, payload: str, last_error: Optional[str] = None) -> None:
        """Atomically moves a failed fact from the active dispatch queue to the DLQ table.
        
        Args:
            fact_id: ID of the fact to move.
            payload: JSON string representation of the VerifiedBuildFact.
            last_error: Optional final error message.
        """
        if not self._connection:
            await self.connect()
        assert self._connection is not None

        try:
            await self._connection.execute("BEGIN TRANSACTION")

            # Get existing retry count from dispatch_queue if available
            async with self._connection.execute(
                "SELECT retries, created_at FROM dispatch_queue WHERE fact_id = ?", 
                (fact_id,)
            ) as cursor:
                row = await cursor.fetchone()
                retries = row["retries"] if row else 3
                created_at = row["created_at"] if row else datetime.now(timezone.utc).isoformat()

            await self._connection.execute(
                """INSERT INTO dlq 
                   (id, fact_id, status, payload, retries, last_error, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (fact_id, fact_id, "failed", payload, retries, last_error, created_at)
            )

            await self._connection.execute(
                "DELETE FROM dispatch_queue WHERE fact_id = ?", (fact_id,)
            )

            await self._connection.commit()
            logger.info("database.moved_to_dlq", fact_id=fact_id, error=last_error)
        except Exception as e:
            if self._connection:
                await self._connection.rollback()
            logger.error("database.move_to_dlq_failed", fact_id=fact_id, error=str(e))
            raise

    async def get_history(self) -> List[Dict[str, Any]]:
        """Returns the history of dispatched and failed posts."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT id, created_at, updated_at, payload, status, last_error FROM dispatch_queue WHERE status IN ('dispatched', 'failed') ORDER BY updated_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            items = []
            for row in rows:
                fact = VerifiedBuildFact.model_validate_json(row["payload"])
                platform = ", ".join(fact.deployed_to) if fact.deployed_to else "Unknown"
                
                # Use updated_at to show when the publication or failure actually occurred
                display_time = row["updated_at"]
                
                items.append({
                    "id": row["id"],
                    "created_at": display_time,
                    "platform": platform,
                    "summary": fact.summary,
                    "status": row["status"],
                    "url": fact.source_repo,
                    "error": row["last_error"]
                })
            return items

    async def log_event(
        self,
        session_id: str,
        event_type: str,
        status: str,
        detail: str = None,
        duration_ms: int = None,
        fact_id: str = None
    ) -> None:
        """Logs a pipeline event to the database."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        event_id = f"evt_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        
        await self._connection.execute(
            """INSERT INTO pipeline_events 
               (id, session_id, event_type, timestamp, status, detail, duration_ms, fact_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (event_id, session_id, event_type, now, status, detail, duration_ms, fact_id)
        )
        await self._connection.commit()
        logger.debug("database.event_logged", event_type=event_type, status=status)

    async def get_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieves recent pipeline events."""
        if not self._connection:
            await self.connect()
        assert self._connection is not None
        
        async with self._connection.execute(
            "SELECT * FROM pipeline_events ORDER BY timestamp DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]