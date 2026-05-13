import pytest
import pytest_asyncio
import os
from ingestion.deduplicator import compute_hash, is_duplicate, mark_seen
from core.database import Database

@pytest.fixture
def sample_payload():
    return {"id": 123, "event": "push", "data": "test"}

@pytest_asyncio.fixture
async def db():
    db_path = "test_dedup.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    database = Database(f"sqlite:///{db_path}")
    await database.connect()
    await database.initialize()
    yield database
    await database.disconnect()
    if os.path.exists(db_path):
        os.remove(db_path)

def test_compute_hash_determinism(sample_payload):
    """Same payload should always produce same hash."""
    h1 = compute_hash(sample_payload)
    h2 = compute_hash(sample_payload)
    assert h1 == h2
    assert len(h1) == 64 # SHA-256 hex length

def test_compute_hash_diff_order():
    """Different key order should produce same hash."""
    p1 = {"a": 1, "b": 2}
    p2 = {"b": 2, "a": 1}
    assert compute_hash(p1) == compute_hash(p2)

@pytest.mark.asyncio
async def test_deduplication_flow(db, sample_payload):
    """Test the full flow: check -> mark -> check."""
    h = compute_hash(sample_payload)
    
    # Not a duplicate initially
    assert await is_duplicate(db, h) is False
    
    # Mark as seen
    await mark_seen(db, h)
    
    # Now it is a duplicate
    assert await is_duplicate(db, h) is True

@pytest.mark.asyncio
async def test_mark_seen_idempotency(db, sample_payload):
    """Marking seen twice should not raise exception (handled internally)."""
    h = compute_hash(sample_payload)
    await mark_seen(db, h)
    # Second time - should log warning but not crash
    await mark_seen(db, h)
    assert await is_duplicate(db, h) is True
