import pytest
import pytest_asyncio
import os
import aiosqlite
from core.database import Database
from core.models import VerifiedBuildFact, FactType

@pytest_asyncio.fixture(scope="function")
async def db_instance():
    db_path = "test_proofpost.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    
    database = Database(f"sqlite:///{db_path}")
    await database.connect()
    await database.initialize()
    yield database
    await database.disconnect()
    if os.path.exists(db_path):
        os.remove(db_path)

@pytest.mark.asyncio
async def test_database_initialization(db_instance):
    """Check if tables are created."""
    async with aiosqlite.connect(db_instance.db_path) as conn:
        async with conn.execute("SELECT name FROM sqlite_master WHERE type='table'") as cursor:
            tables = [row[0] for row in await cursor.fetchall()]
            assert "dispatch_queue" in tables
            assert "dlq" in tables
            assert "idempotency" in tables

@pytest.mark.asyncio
async def test_idempotency_operations(db_instance):
    """Test adding and checking duplicate hashes."""
    test_hash = "abc123hash"
    
    # Not a duplicate initially
    assert await db_instance.is_duplicate(test_hash) is False
    
    # Add to idempotency
    await db_instance.add_to_idempotency(test_hash)
    
    # Now it's a duplicate
    assert await db_instance.is_duplicate(test_hash) is True
    
    # Adding again should raise IntegrityError (wrapped or raw)
    with pytest.raises(aiosqlite.IntegrityError):
        await db_instance.add_to_idempotency(test_hash)

@pytest.mark.asyncio
async def test_fact_queue_operations(db_instance):
    """Test enqueuing and retrieving facts."""
    fact = VerifiedBuildFact(
        id="fact_1",
        source_event_id="event_1",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Build successful",
        detail="All tests passed",
        source_repo="repo",
        source_commit="abc",
        confidence_score=1.0
    )
    
    await db_instance.enqueue_fact(fact)
    
    pending = await db_instance.get_pending_facts()
    assert len(pending) == 1
    assert pending[0].id == "fact_1"
    assert pending[0].summary == "Build successful"

@pytest.mark.asyncio
async def test_update_status(db_instance):
    """Test status updates."""
    fact = VerifiedBuildFact(
        id="fact_2",
        source_event_id="event_2",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Test fact",
        detail="detail",
        source_repo="repo",
        source_commit="abc",
        confidence_score=1.0
    )
    await db_instance.enqueue_fact(fact)
    
    await db_instance.update_fact_status(fact.id, "dispatched")
    
    pending = await db_instance.get_pending_facts()
    assert len(pending) == 0
    
    async with aiosqlite.connect(db_instance.db_path) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT status FROM dispatch_queue WHERE fact_id = ?", (fact.id,)) as cursor:
            row = await cursor.fetchone()
            assert row["status"] == "dispatched"
