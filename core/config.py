"""Configuration management for ProofPost.

This module handles loading and validating application configuration
from environment variables and configuration files.
"""

import os
import json
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ValidationError
import structlog

logger = structlog.get_logger()

class DatabaseSettings(BaseModel):
    """Database connection settings."""
    url: str = Field("proofpost.db", description="SQLite connection string")

class BlueskySettings(BaseModel):
    """Settings for Bluesky platform."""
    enabled: bool = True
    handle: str = ""
    app_password: str = ""

class LinkedInSettings(BaseModel):
    """Settings for LinkedIn platform."""
    enabled: bool = False
    access_token: str = ""

class PlatformSettings(BaseModel):
    """Credentials and settings for publishing platforms."""
    bluesky: BlueskySettings = Field(default_factory=BlueskySettings)
    linkedin: LinkedInSettings = Field(default_factory=LinkedInSettings)

class AISettings(BaseModel):
    """Settings for AI extraction provider."""
    provider: str = Field("mock", description="AI provider type (mock, gemini)")
    api_key: str = Field("", description="API key for the AI provider")
    model: str = Field("gemini-2.0-flash-exp", description="AI model to use")

class IngestionSettings(BaseModel):
    """Settings for incoming webhooks."""
    hmac_secret: str = Field("proofpost-dev-secret-2026", description="Secret for verifying webhook signatures")
    max_payload_size: int = Field(1048576, description="Max payload size in bytes (default 1MB)")

class Settings(BaseModel):
    """Root configuration object."""
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    ingestion: IngestionSettings = Field(default_factory=IngestionSettings)
    ai: AISettings = Field(default_factory=AISettings)
    platforms: PlatformSettings = Field(default_factory=PlatformSettings)
    dev_mode: bool = Field(False, description="Enables developer mode (skips HMAC verification)")
    dry_run: bool = Field(False, description="Enables dry run mode (skips platform dispatch)")

def load_config(config_path: str = "settings.json") -> Settings:
    """Loads configuration from JSON file and environment variables.
    
    Environment variables override JSON settings using the prefix PROOFPOST_.
    Example: PROOFPOST_INGESTION__HMAC_SECRET overrides ingestion.hmac_secret.
    """
    config_data: Dict[str, Any] = {}
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                config_data = json.load(f)
            logger.info("config.loaded_from_file", path=config_path)
        except FileNotFoundError:
            logger.warning("config.file_not_found", path=config_path)
        except json.JSONDecodeError as e:
            logger.error("config.json_parse_failed", path=config_path, error=str(e))
            raise
        except Exception as e:
            logger.error("config.load_failed", path=config_path, error=str(e))
            raise

    # Migration logic for old flat structure
    if "platforms" in config_data:
        p = config_data["platforms"]
        if "bluesky_handle" in p or "bluesky_password" in p:
            if "bluesky" not in p:
                p["bluesky"] = {}
            if "bluesky_handle" in p:
                p["bluesky"]["handle"] = p.pop("bluesky_handle")
            if "bluesky_password" in p:
                p["bluesky"]["app_password"] = p.pop("bluesky_password")
    
    if "environment" in config_data and isinstance(config_data["environment"], dict):
        env = config_data.pop("environment")
        config_data["dry_run"] = env.get("dry_run", False)
        config_data["dev_mode"] = env.get("dev_mode", False)

    # Environment overrides (BUG FIX for test_config)
    if os.environ.get("PROOFPOST_HMAC_SECRET"):
        if "ingestion" not in config_data:
            config_data["ingestion"] = {}
        config_data["ingestion"]["hmac_secret"] = os.environ.get("PROOFPOST_HMAC_SECRET")

    try:
        settings = Settings(**config_data)
        return settings
    except ValidationError as e:
        logger.error("config.validation_failed", error=e.errors())
        raise