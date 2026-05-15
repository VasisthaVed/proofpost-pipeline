import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from core.models import VerifiedBuildFact, FactType
from execution.dispatcher import Dispatcher

class MockBlueskyAdapter:
    async def dispatch(self, fact):
        return True

class MockLinkedInAdapter:
    def __init__(self):
        self.call_count = 0
    async def dispatch(self, fact):
        self.call_count += 1
        if self.call_count == 1:
            return Exception("Temporary error")
        return True

@pytest.mark.asyncio
async def test_dispatcher_incremental_retry_logic():
    """Verify that successful platforms are not called twice during retries."""
    # 1. Setup mocks
    event_bus = MagicMock()
    database = MagicMock()
    database.update_fact_payload = AsyncMock()
    database.update_fact_status = AsyncMock()
    database.transition_fact_status = AsyncMock(return_value=True)
    database.get_recoverable_facts = AsyncMock(return_value=[])
    
    jitter = MagicMock()
    jitter.wait_backoff = AsyncMock()
    
    adapter1 = MockBlueskyAdapter()
    adapter1.dispatch = AsyncMock(return_value=True)
    
    adapter2 = MockLinkedInAdapter()
    # We wrap it to track calls more easily
    adapter2.dispatch = AsyncMock(side_effect=adapter2.dispatch)
    
    adapters = [adapter1, adapter2]
    
    # 2. Create dispatcher
    dispatcher = Dispatcher(event_bus, database, jitter, adapters, max_retries=3)
    
    # 3. Create a fact
    fact = VerifiedBuildFact(
        id="fact_test_retry",
        source_event_id="e1",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Test fact",
        detail="Detail",
        source_repo="repo",
        source_commit="sha",
        confidence_score=1.0,
        deployed_to=[]
    )
    
    # 4. Run _process_fact
    database.get_fact_with_status = AsyncMock(return_value=(fact, "approved"))
    await dispatcher._process_fact(fact, "trace-123")
    
    # 5. Verify expectations
    # Adapter 1 should only have been called ONCE (succeeded first try)
    assert adapter1.dispatch.call_count == 1
    
    # Adapter 2 should have been called TWICE (failed then succeeded)
    assert adapter2.dispatch.call_count == 2
    
    # fact.deployed_to should contain both
    assert "mockbluesky" in fact.deployed_to
    assert "mocklinkedin" in fact.deployed_to
    
    # database.update_fact_payload should have been called at each success point
    # 1 for Bluesky success, 1 for LinkedIn success
    assert database.update_fact_payload.call_count == 2
    
    # database.update_fact_status should be set to dispatched at the end
    database.update_fact_status.assert_called_with(fact.id, "dispatched")

@pytest.mark.asyncio
async def test_dispatcher_already_fully_dispatched():
    """Verify that if all platforms are already in deployed_to, no dispatches happen."""
    event_bus = MagicMock()
    database = MagicMock()
    database.update_fact_status = AsyncMock()
    database.transition_fact_status = AsyncMock(return_value=True)
    jitter = MagicMock()
    
    adapter1 = MockBlueskyAdapter()
    adapter1.dispatch = AsyncMock()
    
    fact = VerifiedBuildFact(
        id="fact_already_done",
        source_event_id="e1",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Test",
        detail="Detail",
        source_repo="repo",
        source_commit="sha",
        confidence_score=1.0,
        deployed_to=["MockBluesky"]
    )
    
    database.get_fact_with_status = AsyncMock(return_value=(fact, "approved"))
    dispatcher = Dispatcher(event_bus, database, jitter, [adapter1])
    await dispatcher._process_fact(fact, "trace-456")
    
    assert adapter1.dispatch.call_count == 0
    database.update_fact_status.assert_called_with(fact.id, "dispatched")
