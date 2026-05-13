import pytest
import asyncio
from extraction.extractor import Extractor
from extraction.mock_provider import MockLLMProvider
from extraction.base_provider import BaseLLMProvider
from core.models import VerifiedBuildFact, FactType

class TimeoutProvider(BaseLLMProvider):
    """Provider that always timeouts."""
    async def extract_facts(self, payload: dict):
        await asyncio.sleep(2) # Extractor timeout will be set to 1
        return []

class FailingProvider(BaseLLMProvider):
    """Provider that always raises an exception."""
    async def extract_facts(self, payload: dict):
        raise ValueError("Simulated provider failure")

class InvalidObjectProvider(BaseLLMProvider):
    """Provider that returns invalid objects."""
    async def extract_facts(self, payload: dict):
        return ["not a fact object", 123]

@pytest.mark.asyncio
async def test_extractor_success():
    """Should return facts from a successful provider call."""
    provider = MockLLMProvider()
    extractor = Extractor(provider)
    payload = {"text": "Build succeeded"}
    
    facts = await extractor.extract(payload)
    
    assert len(facts) == 2
    assert all(isinstance(f, VerifiedBuildFact) for f in facts)

@pytest.mark.asyncio
async def test_extractor_timeout():
    """Should return empty list on provider timeout."""
    provider = TimeoutProvider()
    extractor = Extractor(provider, timeout=1)
    payload = {"text": "will timeout"}
    
    facts = await extractor.extract(payload)
    
    assert facts == []

@pytest.mark.asyncio
async def test_extractor_failure():
    """Should return empty list on provider exception."""
    provider = FailingProvider()
    extractor = Extractor(provider)
    payload = {"text": "will fail"}
    
    facts = await extractor.extract(payload)
    
    assert facts == []

@pytest.mark.asyncio
async def test_extractor_invalid_objects():
    """Should filter out objects that are not VerifiedBuildFact instances."""
    provider = InvalidObjectProvider()
    extractor = Extractor(provider)
    payload = {"text": "returns junk"}
    
    facts = await extractor.extract(payload)
    
    assert facts == []

@pytest.mark.asyncio
async def test_extractor_mixed_objects():
    """Should return only valid VerifiedBuildFact objects if mixed."""
    class MixedProvider(BaseLLMProvider):
        async def extract_facts(self, payload: dict):
            return [
                VerifiedBuildFact(
                    id="valid_1",
                    source_event_id="e1",
                    fact_type=FactType.BUILD_SUCCESS,
                    summary="Valid",
                    detail="Detail",
                    source_repo="repo",
                    source_commit="commit",
                    confidence_score=1.0
                ),
                "invalid string"
            ]
    
    provider = MixedProvider()
    extractor = Extractor(provider)
    payload = {"text": "mixed results"}
    
    facts = await extractor.extract(payload)
    
    assert len(facts) == 1
    assert facts[0].id == "valid_1"
