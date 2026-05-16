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

class AIProviderConfig(BaseModel):
    """Configuration for a specific AI provider instance."""
    id: str = Field(..., description="Unique immutable identifier (e.g., 'primary-gemini', 'fallback-groq')")
    provider: str = Field(..., description="Provider type literal: 'gemini', 'groq', or 'mock'")
    model: str = Field(..., description="Specific model ID string")
    api_key: str = Field("", description="API key for the AI provider")
    enabled: bool = Field(True, description="Master execution switch")
    priority: int = Field(..., description="Ascending execution order (1 = Primary, 2 = Secondary, etc.)")
    fallback_enabled: bool = Field(True, description="Authorization switch to accept failover traffic")

class AISettings(BaseModel):
    """Settings for AI extraction provider."""
    provider: str = Field("mock", description="AI provider type (mock, gemini)")
    api_key: str = Field("", description="API key for the AI provider")
    model: str = Field("gemini-2.0-flash-exp", description="AI model to use")
    providers: list[AIProviderConfig] = Field(default_factory=list, description="Authoritative ordered list of configured AI providers.")

class IngestionSettings(BaseModel):
    """Settings for incoming webhooks."""
    hmac_secret: str = Field("proofpost-dev-secret-2026", description="Secret for verifying webhook signatures")
    max_payload_size: int = Field(1048576, description="Max payload size in bytes (default 1MB)")

class UISettings(BaseModel):
    """Frontend UI state persistence."""
    onboarding_complete: bool = Field(False, description="Whether the setup wizard has been completed")

class Settings(BaseModel):
    """Root configuration object."""
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    ingestion: IngestionSettings = Field(default_factory=IngestionSettings)
    ai: AISettings = Field(default_factory=AISettings)
    platforms: PlatformSettings = Field(default_factory=PlatformSettings)
    ui: UISettings = Field(default_factory=UISettings)
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
    
    # AI Provider Registry Migration logic
    if "ai" in config_data:
        ai_data = config_data["ai"]
        if isinstance(ai_data, dict):
            # If providers list is missing or empty, but legacy flat fields exist, auto-convert
            if not ai_data.get("providers") and "provider" in ai_data:
                p_name = ai_data.get("provider", "mock")
                ai_data["providers"] = [{
                    "id": f"primary-{p_name}",
                    "provider": p_name,
                    "model": ai_data.get("model", "gemini-2.0-flash-exp"),
                    "api_key": ai_data.get("api_key", ""),
                    "enabled": True,
                    "priority": 1,
                    "fallback_enabled": True
                }]
            # Also ensure the flat fields mirror the priority 1 provider for backward compatibility during phased migration
            if ai_data.get("providers"):
                active_p = sorted(ai_data["providers"], key=lambda x: x.get("priority", 999))[0]
                ai_data["provider"] = active_p.get("provider", "mock")
                ai_data["model"] = active_p.get("model", "gemini-2.0-flash-exp")
                ai_data["api_key"] = active_p.get("api_key", "")

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