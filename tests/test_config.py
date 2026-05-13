import pytest
import os
import json
from core.config import load_config, Settings
from pydantic import ValidationError

def test_load_config_missing_file_use_defaults():
    """Should use default values if settings.json is missing and no env var set."""
    if os.path.exists("settings.json"):
        os.remove("settings.json")
    if "PROOFPOST_HMAC_SECRET" in os.environ:
        del os.environ["PROOFPOST_HMAC_SECRET"]
    
    settings = load_config("nonexistent.json")
    assert settings.ingestion.hmac_secret == "proofpost-dev-secret-2026"
    assert settings.database.url == "proofpost.db"

def test_load_config_from_file(tmp_path):
    """Should load settings from a JSON file."""
    config_file = tmp_path / "settings.json"
    config_data = {
        "ingestion": {
            "hmac_secret": "test_secret_123"
        },
        "database": {
            "url": "sqlite:///test_db.db"
        }
    }
    config_file.write_text(json.dumps(config_data))
    
    settings = load_config(str(config_file))
    assert settings.ingestion.hmac_secret == "test_secret_123"
    assert settings.database.url == "sqlite:///test_db.db"

def test_load_config_env_override():
    """Should override file settings with environment variables."""
    # We'll use a dummy file and override with env
    config_data = {
        "ingestion": {
            "hmac_secret": "file_secret"
        }
    }
    with open("temp_settings.json", "w") as f:
        json.dump(config_data, f)
    
    os.environ["PROOFPOST_HMAC_SECRET"] = "env_secret"
    try:
        settings = load_config("temp_settings.json")
        assert settings.ingestion.hmac_secret == "env_secret"
    finally:
        if os.path.exists("temp_settings.json"):
            os.remove("temp_settings.json")
        if "PROOFPOST_HMAC_SECRET" in os.environ:
            del os.environ["PROOFPOST_HMAC_SECRET"]
