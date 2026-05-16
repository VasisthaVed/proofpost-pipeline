import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from core.main import app, state
from core.config import Settings, AIProviderConfig, AISettings
from extraction.provider_factory import ProviderFactory

@pytest.fixture
def test_ai_settings():
    return Settings(
        ai=AISettings(
            provider="gemini",
            api_key="legacy_key",
            model="gemini-1.5-flash",
            providers=[
                AIProviderConfig(id="p1", provider="gemini", model="gemini-2.5-pro", api_key="key1", priority=1, enabled=True, fallback_enabled=True),
                AIProviderConfig(id="p2", provider="groq", model="llama-3.3-70b-versatile", api_key="key2", priority=2, enabled=True, fallback_enabled=True),
                AIProviderConfig(id="p3", provider="mock", model="mock", api_key="key3", priority=3, enabled=False, fallback_enabled=False),
            ]
        ),
        environment="test"
    )

@pytest.fixture
def client(test_ai_settings):
    with patch("core.main.load_config", return_value=test_ai_settings):
        with TestClient(app) as c:
            yield c

def test_get_ai_providers_masked(client):
    """GET /api/ai/providers returns configured providers with masked keys."""
    response = client.get("/api/ai/providers")
    assert response.status_code == 200
    data = response.json()
    assert len(data["providers"]) == 3
    assert data["providers"][0]["api_key"] == "****"
    assert data["providers"][1]["api_key"] == "****"
    assert data["providers"][2]["api_key"] == "****"
    assert data["providers"][0]["model"] == "gemini-2.5-pro"

@pytest.mark.asyncio
async def test_save_ai_providers(client):
    """POST /api/ai/providers updates registry and reloads settings."""
    new_providers = {
        "providers": [
            {
                "id": "p1",
                "provider": "gemini",
                "model": "gemini-2.5-pro",
                "api_key": "new_key1",
                "enabled": True,
                "priority": 1,
                "fallback_enabled": True
            }
        ]
    }
    expected_settings = Settings(
        ai=AISettings(
            provider="gemini",
            api_key="legacy_key",
            model="gemini-1.5-flash",
            providers=[
                AIProviderConfig(id="p1", provider="gemini", model="gemini-2.5-pro", api_key="new_key1", priority=1, enabled=True, fallback_enabled=True)
            ]
        ),
        environment="test"
    )
    m = MagicMock()
    with patch("builtins.open", m):
        with patch("json.dump") as mock_dump:
            with patch("core.main.load_config", return_value=expected_settings):
                response = client.post("/api/ai/providers", json=new_providers)
                assert response.status_code == 200
                assert response.json()["success"] is True
                assert len(response.json()["data"]["providers"]) == 1
                mock_dump.assert_called_once()

@pytest.mark.asyncio
async def test_test_ai_provider_endpoint(client):
    """POST /api/ai/providers/test tests connectivity for a specific provider config."""
    payload = {
        "id": "p3",
        "provider": "mock",
        "model": "mock",
        "api_key": "test_key",
        "enabled": True,
        "priority": 3,
        "fallback_enabled": True
    }
    response = client.post("/api/ai/providers/test", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"] == "Connected successfully"

@pytest.mark.asyncio
async def test_reorder_ai_providers(client):
    """POST /api/ai/providers/reorder updates priority order deterministically."""
    payload = {
        "provider_ids": ["p2", "p1", "p3"]
    }
    expected_settings = Settings(
        ai=AISettings(
            provider="gemini",
            api_key="legacy_key",
            model="gemini-1.5-flash",
            providers=[
                AIProviderConfig(id="p2", provider="groq", model="llama-3.3-70b-versatile", api_key="key2", priority=1, enabled=True, fallback_enabled=True),
                AIProviderConfig(id="p1", provider="gemini", model="gemini-2.5-pro", api_key="key1", priority=2, enabled=True, fallback_enabled=True),
                AIProviderConfig(id="p3", provider="mock", model="mock", api_key="key3", priority=3, enabled=False, fallback_enabled=False),
            ]
        ),
        environment="test"
    )
    m = MagicMock()
    with patch("builtins.open", m):
        with patch("json.dump") as mock_dump:
            with patch("core.main.load_config", return_value=expected_settings):
                response = client.post("/api/ai/providers/reorder", json=payload)
                assert response.status_code == 200
                assert response.json()["success"] is True
                providers = response.json()["data"]["providers"]
                assert providers[0]["id"] == "p2"
                assert providers[0]["priority"] == 1
                assert providers[1]["id"] == "p1"
                assert providers[1]["priority"] == 2

@pytest.mark.asyncio
async def test_get_ai_provider_models(client):
    """POST /api/ai/providers/models executes hybrid model discovery."""
    payload = {
        "provider": "mock",
        "api_key": "test_key",
        "model": "p3"
    }
    response = client.post("/api/ai/providers/models", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "mock"
    assert "mock" in data["models"]
    assert "mock-reasoning" in data["models"]
    assert data["default_model"] == "mock"

def test_provider_factory_unmasking(test_ai_settings):
    """ProviderFactory._resolve_api_key unmasks keys against active runtime memory."""
    with patch("core.main.state") as mock_state:
        mock_state.settings = test_ai_settings
        
        # Unmask by config_id
        unmasked1 = ProviderFactory._resolve_api_key("gemini", "****", config_id="p1")
        assert unmasked1 == "key1"
        
        # Unmask by flat api_key fallback
        unmasked_flat = ProviderFactory._resolve_api_key("gemini", "****", config_id="nonexistent")
        assert unmasked_flat == "legacy_key"
        
        # Plaintext pass-through
        plaintext = ProviderFactory._resolve_api_key("gemini", "new_plaintext", config_id="p1")
        assert plaintext == "new_plaintext"
