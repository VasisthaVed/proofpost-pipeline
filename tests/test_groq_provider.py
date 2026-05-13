import pytest
import json
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from extraction.groq_provider import GroqProvider
from core.models import VerifiedBuildFact, FactType

@pytest.fixture
def groq_response():
    """Mock response from AsyncGroq client."""
    mock_msg = MagicMock()
    mock_msg.content = json.dumps([
        {
            "fact_type": "feature_added",
            "summary": "New auth layer",
            "source_snippet": "OAuth2 support",
            "detail": "Implemented OAuth2 for better security"
        }
    ])
    
    mock_choice = MagicMock()
    mock_choice.message = mock_msg
    
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    return mock_resp

@pytest.fixture
def provider():
    """Fixture for GroqProvider with mocked AsyncGroq."""
    with patch("extraction.groq_provider.AsyncGroq") as mock_groq_class:
        mock_client_instance = mock_groq_class.return_value
        # Ensure nested structure exists
        mock_client_instance.chat = MagicMock()
        mock_client_instance.chat.completions = MagicMock()
        
        p = GroqProvider(api_key="fake_key", model="fake-model")
        return p

@pytest.mark.asyncio
async def test_groq_extract_facts_success(provider, groq_response):
    """Should successfully parse Groq JSON response into VerifiedBuildFact list."""
    payload = {"id": "evt_1", "repository": {"full_name": "org/repo"}, "after": "sha123"}
    
    with patch.object(provider.client.chat.completions, "create", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = groq_response
        facts = await provider.extract_facts(payload)
        
        assert len(facts) == 1
        assert facts[0].fact_type == FactType.FEATURE_ADDED
        assert facts[0].summary == "New auth layer"
        
        mock_gen.assert_called_once()
        args, kwargs = mock_gen.call_args
        assert kwargs["model"] == "fake-model"
        assert kwargs["response_format"] == {"type": "json_object"}

@pytest.mark.asyncio
async def test_groq_extract_facts_failure(provider):
    """Should return empty list on API failure."""
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.chat.completions, "create", new_callable=AsyncMock) as mock_gen:
        mock_gen.side_effect = Exception("API Error")
        facts = await provider.extract_facts(payload)
        assert facts == []

@pytest.mark.asyncio
async def test_groq_extract_facts_timeout(provider):
    """Should return empty list on timeout."""
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.chat.completions, "create", new_callable=AsyncMock) as mock_gen:
        async def slow_call(*args, **kwargs):
            await asyncio.sleep(20)
            return MagicMock()
            
        mock_gen.side_effect = slow_call
        facts = await provider.extract_facts(payload)
        assert facts == []

@pytest.mark.asyncio
async def test_groq_handles_markdown_stripping(provider):
    """Should strip markdown blocks if LLM includes them."""
    mock_msg = MagicMock()
    mock_msg.content = "```json\n[{\"fact_type\": \"bug_fixed\", \"summary\": \"Fix 1\"}]\n```"
    mock_choice = MagicMock()
    mock_choice.message = mock_msg
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    
    payload = {"id": "evt_1"}
    
    with patch.object(provider.client.chat.completions, "create", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_resp
        facts = await provider.extract_facts(payload)
        assert len(facts) == 1
        assert facts[0].fact_type == FactType.BUG_FIXED
