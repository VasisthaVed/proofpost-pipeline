import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from core.main import app, state
from core.config import Settings, DatabaseSettings, IngestionSettings, PlatformSettings

@pytest.fixture
def test_settings():
    return Settings(
        database=DatabaseSettings(url="sqlite:///:memory:"),
        platforms=PlatformSettings(),
        ingestion=IngestionSettings(hmac_secret="test_secret", max_payload_size=1024),
        environment="test"
    )

@pytest.fixture
def client(test_settings):
    # Mock load_config to use our test settings
    with patch("core.main.load_config", return_value=test_settings):
        with TestClient(app) as c:
            yield c

def test_health_check(client):
    """Should return 200 OK on health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_lifespan_initialization(test_settings):
    """Should initialize all core components during startup."""
    with patch("core.main.load_config", return_value=test_settings):
        # We use the app lifespan directly for this test
        async with app.router.lifespan_context(app):
            assert state.db is not None
            assert state.bus is not None
            assert state.dispatcher is not None
            assert state.extractor is not None
            assert state.dispatch_task is not None
            assert not state.dispatch_task.done()

def test_webhook_invalid_signature(client):
    """Should return 401 if HMAC signature is missing or invalid."""
    payload = {"some": "data"}
    response = client.post(
        "/webhook/github", 
        json=payload, 
        headers={"X-Hub-Signature-256": "invalid"}
    )
    assert response.status_code == 401

def test_webhook_payload_too_large(client):
    """Should return 413 if payload exceeds max size."""
    large_payload = "x" * 2000
    response = client.post(
        "/webhook/github", 
        content=large_payload,
        headers={"X-Hub-Signature-256": "anything"}
    )
    assert response.status_code == 413

@pytest.mark.asyncio
async def test_trace_id_propagation(test_settings):
    """Should propagate trace_id from header to response and logs."""
    custom_trace = "custom-trace-123"
    with patch("core.main.load_config", return_value=test_settings):
        with TestClient(app) as client:
            response = client.get("/health", headers={"X-Trace-ID": custom_trace})
            assert response.headers["X-Trace-ID"] == custom_trace

@pytest.mark.asyncio
async def test_webhook_success_flow(test_settings):
    """Should successfully process a valid webhook through the whole pipeline."""
    import hmac
    import hashlib
    import json
    
    payload = {"text": "Build Success: Verified Fact"}
    body = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(
        test_settings.ingestion.hmac_secret.encode(), 
        body, 
        hashlib.sha256
    ).hexdigest()
    
    with patch("core.main.load_config", return_value=test_settings):
        # Mocking extractor to return deterministic facts
        from core.models import VerifiedBuildFact, FactType
        mock_fact = VerifiedBuildFact(
            id="f1", source_event_id="e1", fact_type=FactType.BUILD_SUCCESS,
            summary="Success", detail="Verified Fact", source_repo="r", source_commit="c",
            confidence_score=1.0, source_snippet="Verified Fact"
        )
        
        with patch("core.main.Extractor.extract", new_callable=AsyncMock) as mock_extract:
            mock_extract.return_value = [mock_fact]
            
            with TestClient(app) as client:
                # We need to mock the db method on the state object
                state.db.persist_pipeline_result = AsyncMock()
                
                response = client.post(
                    "/webhook/github",
                    content=body,
                    headers={"X-Hub-Signature-256": signature, "Content-Type": "application/json"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "accepted"
                assert data["facts_verified"] == 1
                state.db.persist_pipeline_result.assert_called_once()

@pytest.mark.asyncio
async def test_get_pending_facts(client):
    """Should return a list of pending facts from the database."""
    from core.models import VerifiedBuildFact, FactType
    mock_fact = VerifiedBuildFact(
        id="f1", source_event_id="e1", fact_type=FactType.BUILD_SUCCESS,
        summary="Success", detail="Detail", source_repo="r", source_commit="c",
        confidence_score=1.0, source_snippet="Snippet"
    )
    
    with patch.object(state.db, "get_pending_facts", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = [mock_fact]
        response = client.get("/api/facts/pending")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == "f1"

@pytest.mark.asyncio
async def test_approve_fact(client):
    """Should update status and enqueue fact in event bus."""
    from core.models import VerifiedBuildFact, FactType
    mock_fact = VerifiedBuildFact(
        id="f1", source_event_id="e1", fact_type=FactType.BUILD_SUCCESS,
        summary="Success", detail="Detail", source_repo="r", source_commit="c",
        confidence_score=1.0, source_snippet="Snippet"
    )
    
    with patch.object(state.db, "get_fact_by_id", new_callable=AsyncMock) as mock_get_fact:
        mock_get_fact.return_value = mock_fact
        with patch.object(state.db, "update_fact_status", new_callable=AsyncMock) as mock_update:
            with patch.object(state.bus, "enqueue", new_callable=AsyncMock) as mock_enqueue:
                response = client.post("/api/facts/f1/approve")
                
                assert response.status_code == 200
                assert response.json()["status"] == "success"
                mock_update.assert_called_with("f1", "approved")
                mock_enqueue.assert_called_once()

@pytest.mark.asyncio
async def test_reject_fact(client):
    """Should update status to 'rejected'."""
    with patch.object(state.db, "update_fact_status", new_callable=AsyncMock) as mock_update:
        response = client.post("/api/facts/f1/reject")
        
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_update.assert_called_with("f1", "rejected")

@pytest.mark.asyncio
async def test_get_history(client):
    """Should return dispatched facts from the database."""
    from core.models import VerifiedBuildFact, FactType
    mock_fact = VerifiedBuildFact(
        id="f1", source_event_id="e1", fact_type=FactType.BUILD_SUCCESS,
        summary="History Item", detail="Detail", source_repo="r", source_commit="c",
        confidence_score=1.0
    )
    
    mock_history_data = [
        {"id": "f1", "created_at": mock_fact.created_at, "platform": "Unknown", "summary": "History Item", "status": "dispatched", "url": None}
    ]
    
    with patch.object(state.db, "get_history", new_callable=AsyncMock) as mock_get_history:
        mock_get_history.return_value = mock_history_data
        response = client.get("/api/history")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["summary"] == "History Item"

@pytest.mark.asyncio
async def test_get_platforms(client):
    """Should return the list of platforms from settings."""
    response = client.get("/api/platforms")
    assert response.status_code == 200
    data = response.json()
    # At least LinkedIn should be there based on my implementation
    platform_ids = [p["id"] for p in data["platforms"]]
    assert "linkedin" in platform_ids

@pytest.mark.asyncio
async def test_test_platform_success(client):
    """Should call authenticate on the adapter and return success."""
    from platforms.linkedin import LinkedInAdapter
    mock_adapter = MagicMock(spec=LinkedInAdapter)
    mock_adapter.authenticate = AsyncMock(return_value=True)
    
    with patch.object(state.dispatcher, "adapters", [mock_adapter]):
        response = client.post("/api/platforms/linkedin/test")
        assert response.status_code == 200
        assert response.json()["connected"] is True

@pytest.mark.asyncio
async def test_get_settings_masked(client, test_settings):
    """Should return settings with masked credentials."""
    test_settings.ingestion.hmac_secret = "secret123"
    with patch("core.main.load_config", return_value=test_settings):
        response = client.get("/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["ingestion"]["hmac_secret"] == "****"
        assert "bluesky" in data["platforms"]

@pytest.mark.asyncio
async def test_save_settings(client, tmp_path):
    """Should save settings to file and update memory state."""
    # Mocking open to avoid writing to real settings.json in tests
    m = MagicMock()
    with patch("builtins.open", m):
        with patch("json.dump") as mock_dump:
            new_config = {
                "ingestion": {"hmac_secret": "new_secret", "max_payload_size": 1048576},
                "platforms": {
                    "bluesky": {"enabled": True, "handle": "new.bsky.social", "app_password": "new_password"},
                    "linkedin": {"enabled": False, "access_token": "new_token"}
                },
                "database": {"url": "test.db"},
                "ai": {"provider": "mock", "api_key": "new_key", "model": "gemini-2.0-flash-exp"},
                "dev_mode": False,
                "dry_run": False
            }
            # Construct expectation object
            expected_settings = Settings(**new_config)
            with patch("core.main.load_config", return_value=expected_settings):
                response = client.post("/api/settings", json=new_config)
                assert response.status_code == 200
                assert state.settings.ingestion.hmac_secret == "new_secret"
                assert state.settings.platforms.linkedin.access_token == "new_token"
                mock_dump.assert_called_once()

@pytest.mark.asyncio
async def test_dev_mode_skips_hmac(test_settings):
    """Should return 200 even with invalid signature when dev_mode is enabled."""
    test_settings.dev_mode = True
    payload = {"some": "data"}
    
    with patch("core.main.load_config", return_value=test_settings):
        # We need to mock extractor because the pipeline continues after HMAC
        with patch("core.main.Extractor.extract", new_callable=AsyncMock) as mock_extract:
            mock_extract.return_value = [] # No facts to process
            with patch.object(state.db, "persist_pipeline_result", new_callable=AsyncMock):
                with TestClient(app) as client:
                    response = client.post(
                        "/webhook/github", 
                        json=payload, 
                        headers={"X-Hub-Signature-256": "invalid"}
                    )
                    assert response.status_code == 200
                    assert response.json()["status"] == "accepted"
