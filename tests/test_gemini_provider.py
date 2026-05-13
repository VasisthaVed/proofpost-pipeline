import pytest
import json
import uuid
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from extraction.gemini_provider import GeminiProvider
from core.models import VerifiedBuildFact, FactType

@pytest.fixture
def gemini_response():
    """Mock response from the new google-genai SDK."""
    mock_resp = MagicMock()
    mock_resp.text = json.dumps([
        {
            "fact_type": "feature_added",
            "summary": "New auth layer",
            "source_snippet": "OAuth2 support",
            "detail": "Implemented OAuth2 for better security"
        }
    ])
    return mock_resp

@pytest.fixture
def provider():
    """Fixture for GeminiProvider with mocked genai.Client."""
    # Patch google.genai.Client during GeminiProvider.__init__
    with patch("google.genai.Client") as mock_client_class:
        # We need the instance to have a 'models' and 'aio' attribute
        mock_client_instance = mock_client_class.return_value
        # Ensure aio.models exists for patching later
        mock_client_instance.aio = MagicMock()
        mock_client_instance.aio.models = MagicMock()
        
        p = GeminiProvider(api_key="fake_key", model="fake-model")
        
        # Verify correct initialization
        mock_client_class.assert_called_once_with(api_key="fake_key")
        return p

@pytest.mark.asyncio
async def test_gemini_extract_facts_success(provider, gemini_response):
    """Should successfully parse Gemini JSON response into VerifiedBuildFact list."""
    payload = {"id": "evt_1", "repository": {"full_name": "org/repo"}, "after": "sha123"}
    
    # Mock the SDK's client.aio.models.generate_content call (now async)
    with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = gemini_response
        facts = await provider.extract_facts(payload)
        
        assert len(facts) == 1
        assert facts[0].fact_type == FactType.FEATURE_ADDED
        assert facts[0].summary == "New auth layer"
        assert facts[0].source_snippet == "OAuth2 support"
        
        # Verify the call was made with correct params
        mock_gen.assert_called_once()
        args, kwargs = mock_gen.call_args
        assert kwargs["model"] == "fake-model"
        assert "contents" in kwargs
        assert kwargs["config"]["response_mime_type"] == "application/json"

@pytest.mark.asyncio
async def test_gemini_extract_facts_failure(provider):
    """Should return empty list on API failure."""
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.side_effect = Exception("API Error")
        facts = await provider.extract_facts(payload)
        assert facts == []

@pytest.mark.asyncio
async def test_gemini_extract_facts_timeout(provider):
    """Should return empty list on timeout."""
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
        # Simulate timeout by delaying response
        async def slow_call(*args, **kwargs):
            await asyncio.sleep(20) # Greater than 15s timeout
            return MagicMock()
            
        mock_gen.side_effect = slow_call
        facts = await provider.extract_facts(payload)
        assert facts == []

@pytest.mark.asyncio
async def test_gemini_handles_invalid_json(provider):
    """Should return empty list on invalid JSON response."""
    mock_resp = MagicMock()
    mock_resp.text = "Invalid JSON"
    
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_resp
        facts = await provider.extract_facts(payload)
        assert facts == []

@pytest.mark.asyncio
async def test_gemini_mapping_logic(provider):
    """Should correctly map various fact types to FactType enum."""
    mock_resp = MagicMock()
    mock_resp.text = json.dumps([
        {"fact_type": "performance_gain", "summary": "Faster"},
        {"fact_type": "security_fix", "summary": "Secure"},
        {"fact_type": "unknown_type", "summary": "Unknown"}
    ])
    
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.aio.models, "generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_resp
        facts = await provider.extract_facts(payload)
        
        assert len(facts) == 3
        assert facts[0].fact_type == FactType.PERFORMANCE_IMPROVED
        assert facts[1].fact_type == FactType.SECURITY_VULNERABILITY
        assert facts[2].fact_type == FactType.FEATURE_ADDED # Default fallback
