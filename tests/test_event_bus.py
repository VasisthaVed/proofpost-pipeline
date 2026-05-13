import pytest
import asyncio
from execution.event_bus import EventBus, EventBusShutdownError
from core.models import VerifiedBuildFact, FactType

@pytest.fixture
def bus():
    return EventBus(max_size=5)

@pytest.fixture
def sample_fact():
    return VerifiedBuildFact(
        id="fact_123",
        source_event_id="evt_456",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Test success",
        detail="Detail",
        source_repo="repo",
        source_commit="commit",
        confidence_score=1.0
    )

@pytest.mark.asyncio
async def test_enqueue_dequeue_flow(bus, sample_fact):
    """Should successfully enqueue and dequeue a fact with trace_id."""
    await bus.enqueue(sample_fact, "trace_abc")
    assert bus.size() == 1
    
    fact, trace_id = await bus.dequeue()
    assert fact.id == "fact_123"
    assert trace_id == "trace_abc"
    assert bus.size() == 0

@pytest.mark.asyncio
async def test_queue_ordering(bus):
    """Should preserve deterministic FIFO order."""
    for i in range(3):
        f = VerifiedBuildFact(
            id=f"f{i}", source_event_id="e", fact_type=FactType.BUILD_SUCCESS,
            summary="s", detail="d", source_repo="r", source_commit="c", confidence_score=1.0
        )
        await bus.enqueue(f, f"t{i}")
    
    assert bus.size() == 3
    
    for i in range(3):
        fact, trace_id = await bus.dequeue()
        assert fact.id == f"f{i}"
        assert trace_id == f"t{i}"

@pytest.mark.asyncio
async def test_concurrent_producers(bus):
    """Should handle multiple concurrent producers safely."""
    async def producer(idx):
        f = VerifiedBuildFact(
            id=f"p{idx}", source_event_id="e", fact_type=FactType.BUILD_SUCCESS,
            summary="s", detail="d", source_repo="r", source_commit="c", confidence_score=1.0
        )
        await bus.enqueue(f, f"t{idx}")

    await asyncio.gather(*(producer(i) for i in range(5)))
    assert bus.size() == 5
    
    results = []
    for _ in range(5):
        fact, trace_id = await bus.dequeue()
        results.append(fact.id)
    
    assert len(set(results)) == 5 # All unique ids reached

@pytest.mark.asyncio
async def test_graceful_shutdown(bus, sample_fact):
    """Should reject new enqueues after shutdown but allow dequeuing remaining."""
    await bus.enqueue(sample_fact, "t1")
    await bus.shutdown()
    
    # Enqueue should fail
    with pytest.raises(EventBusShutdownError):
        await bus.enqueue(sample_fact, "t2")
    
    # Dequeue should still work for the item already in
    fact, trace_id = await bus.dequeue()
    assert fact.id == sample_fact.id
    
    # Next dequeue should raise shutdown error (sentinel reached)
    with pytest.raises(EventBusShutdownError):
        await bus.dequeue()

@pytest.mark.asyncio
async def test_cancellation_during_dequeue(bus):
    """Dequeue should be safely cancellable."""
    task = asyncio.create_task(bus.dequeue())
    await asyncio.sleep(0.1)
    task.cancel()
    
    with pytest.raises(asyncio.CancelledError):
        await task

@pytest.mark.asyncio
async def test_queue_size_metrics(bus, sample_fact):
    """Should report accurate size metrics."""
    assert bus.size() == 0
    await bus.enqueue(sample_fact, "t1")
    assert bus.size() == 1
    await bus.dequeue()
    assert bus.size() == 0
