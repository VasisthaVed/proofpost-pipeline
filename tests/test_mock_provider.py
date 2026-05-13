import pytest
from extraction.mock_provider import MockLLMProvider
from extraction.base_provider import BaseLLMProvider
from core.models import VerifiedBuildFact, FactType

@pytest.fixture
def provider():
    return MockLLMProvider()

@pytest.fixture
def sample_payload():
    return {
        "message": "Deployed auth service v2.1 with OAuth2 support",
        "ref": "refs/heads/main",
        "commit": "abc123"
    }

@pytest.mark.asyncio
async def test_returns_exactly_two_facts(provider, sample_payload):
    """Should return exactly 2 VerifiedBuildFact instances."""
    facts = await provider.extract_facts(sample_payload)
    assert len(facts) == 2

@pytest.mark.asyncio
async def test_returns_valid_verified_build_facts(provider, sample_payload):
    """Both returned items must be valid VerifiedBuildFact instances."""
    facts = await provider.extract_facts(sample_payload)
    for fact in facts:
        assert isinstance(fact, VerifiedBuildFact)

@pytest.mark.asyncio
async def test_fact_types_are_semantic(provider, sample_payload):
    """First fact should be FEATURE_ADDED, second should be BUG_FIXED."""
    facts = await provider.extract_facts(sample_payload)
    assert facts[0].fact_type == FactType.FEATURE_ADDED.value
    assert facts[1].fact_type == FactType.BUG_FIXED.value

@pytest.mark.asyncio
async def test_source_snippet_exists_in_payload(provider, sample_payload):
    """source_snippet of each fact must be a substring of payload text."""
    facts = await provider.extract_facts(sample_payload)
    payload_text = " ".join(str(v) for v in sample_payload.values())
    for fact in facts:
        assert fact.source_snippet is not None
        assert fact.source_snippet in payload_text

@pytest.mark.asyncio
async def test_base_provider_raises():
    """BaseLLMProvider.extract_facts must raise NotImplementedError."""
    base = BaseLLMProvider()
    with pytest.raises(NotImplementedError):
        await base.extract_facts({})

@pytest.mark.asyncio
async def test_deterministic_output(provider, sample_payload):
    """Same payload should always produce the same output."""
    facts_a = await provider.extract_facts(sample_payload)
    facts_b = await provider.extract_facts(sample_payload)
    assert facts_a[0].id == facts_b[0].id
    assert facts_a[1].id == facts_b[1].id
