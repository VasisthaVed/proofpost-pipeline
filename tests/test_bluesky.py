import pytest
from unittest.mock import MagicMock, patch
from platforms.bluesky import BlueskyAdapter
from core.models import VerifiedBuildFact, FactType

@pytest.fixture
def sample_fact():
    return VerifiedBuildFact(
        id="fact_123",
        source_event_id="evt_456",
        fact_type=FactType.FEATURE_ADDED,
        summary="Verified: New authentication layer deployed to production.",
        detail="Implemented OAuth2 support for internal services.",
        source_repo="https://github.com/org/repo",
        source_commit="abc123def456",
        confidence_score=1.0
    )

@pytest.fixture
def adapter():
    return BlueskyAdapter(handle="test.bsky.social", app_password="fake-password")

@pytest.mark.asyncio
async def test_bluesky_authenticate_success(adapter):
    """Should return True when login succeeds."""
    with patch.object(adapter.client, "login") as mock_login:
        success = await adapter.authenticate()
        assert success is True
        mock_login.assert_called_once_with("test.bsky.social", "fake-password")
        assert adapter._authenticated is True

@pytest.mark.asyncio
async def test_bluesky_authenticate_failure(adapter):
    """Should return False when login fails."""
    with patch.object(adapter.client, "login", side_effect=Exception("Login failed")):
        success = await adapter.authenticate()
        assert success is False
        assert adapter._authenticated is False

def test_bluesky_generate_payload_with_hashtags(adapter, sample_fact):
    """Should include relevant hashtags based on fact type."""
    payload = adapter.generate_payload(sample_fact)
    assert "#NewFeature" in payload["text"]
    assert "#Shipping" in payload["text"]
    assert sample_fact.summary in payload["text"]

def test_bluesky_generate_payload_truncation(adapter, sample_fact):
    """Should truncate text if it exceeds 300 characters."""
    sample_fact.summary = "A" * 400
    payload = adapter.generate_payload(sample_fact)
    assert len(payload["text"]) <= 300
    assert payload["text"].endswith("...")

@pytest.mark.asyncio
async def test_bluesky_dispatch_success(adapter, sample_fact):
    """Should call send_post and return success details."""
    mock_response = MagicMock()
    mock_response.uri = "at://did:plc:123/app.bsky.feed.post/post_id_456"
    
    with patch.object(adapter, "authenticate", return_value=True), \
         patch.object(adapter.client, "send_post", return_value=mock_response) as mock_send:
        
        result = await adapter.dispatch(sample_fact)
        
        assert result["success"] is True
        assert "post_id_456" in result["url"]
        assert result["error"] is None
        mock_send.assert_called_once()

@pytest.mark.asyncio
async def test_bluesky_dispatch_dry_run(sample_fact):
    """Should skip real API call and return mock success in dry_run mode."""
    adapter = BlueskyAdapter(handle="test.bsky.social", app_password="f", dry_run=True)
    
    with patch.object(adapter.client, "send_post") as mock_send:
        result = await adapter.dispatch(sample_fact)
        assert result["success"] is True
        assert "mock" in result["url"]
        mock_send.assert_not_called()

@pytest.mark.asyncio
async def test_bluesky_dispatch_auth_failure(adapter, sample_fact):
    """Should return failure if authentication fails."""
    with patch.object(adapter, "authenticate", return_value=False):
        result = await adapter.dispatch(sample_fact)
        assert result["success"] is False
        assert result["error"] == "Authentication failed"
