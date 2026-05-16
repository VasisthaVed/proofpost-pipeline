import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.models import VerifiedBuildFact, FactType
from platforms.linkedin import LinkedInAdapter

@pytest.fixture
def adapter():
    return LinkedInAdapter(access_token="test_token", author_urn="urn:li:person:123")

@pytest.fixture
def sample_fact():
    return VerifiedBuildFact(
        id="fact_123",
        source_event_id="evt_456",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Build Success",
        detail="All tests passed.",
        source_repo="https://github.com/org/repo",
        source_commit="abc123def",
        confidence_score=1.0
    )

def test_generate_payload_format(adapter, sample_fact):
    """Should format the LinkedIn UGC Post payload correctly."""
    payload = adapter.generate_payload(sample_fact)
    
    assert payload["author"] == "urn:li:person:123"
    assert payload["lifecycleState"] == "PUBLISHED"
    content = payload["specificContent"]["com.linkedin.ugc.ShareContent"]
    assert "Build Success" in content["shareCommentary"]["text"]
    assert "abc123def" in content["shareCommentary"]["text"]
    assert payload["visibility"]["com.linkedin.ugc.MemberNetworkVisibility"] == "PUBLIC"

@pytest.mark.asyncio
async def test_authenticate_success(adapter):
    """Should return True if credentials are provided."""
    assert await adapter.authenticate() is True

@pytest.mark.asyncio
async def test_authenticate_failure():
    """Should return False if credentials are missing."""
    bad_adapter = LinkedInAdapter(access_token="", author_urn="")
    assert await bad_adapter.authenticate() is False

@pytest.mark.asyncio
async def test_dispatch_success(adapter, sample_fact):
    """Should return success dictionary on 201 Created response."""
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock(status_code=201, text='{"id": "urn:li:ugcPost:123"}')
        mock_resp.json.return_value = {"id": "urn:li:ugcPost:123"}
        mock_post.return_value = mock_resp
        
        result = await adapter.dispatch(sample_fact)
        
        assert result["success"] is True
        assert result["url"] == "https://www.linkedin.com/feed/update/urn:li:ugcPost:123"
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["json"]["author"] == "urn:li:person:123"

@pytest.mark.asyncio
async def test_dispatch_failure(adapter, sample_fact):
    """Should return failure dictionary on 401 Unauthorized response."""
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = MagicMock(status_code=401, text="Unauthorized")
        
        result = await adapter.dispatch(sample_fact)
        
        assert result["success"] is False
        assert result["error"] == "Unauthorized"

@pytest.mark.asyncio
async def test_dispatch_network_error(adapter, sample_fact):
    """Should return failure dictionary on network exceptions."""
    import httpx
    with patch("httpx.AsyncClient.post", side_effect=httpx.RequestError("Conn error")):
        result = await adapter.dispatch(sample_fact)
        assert result["success"] is False
        assert "Conn error" in result["error"]
