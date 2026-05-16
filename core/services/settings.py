"""Settings service for handling configuration updates, masking/unmasking, and persistence."""

import json
import structlog
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import HTTPException
from core.config import Settings
from core.main import _coerce_ai_model_for_provider
from schemas.responses import ActionResponse

logger = structlog.get_logger()

class SettingsUpdateResult(BaseModel):
    """Pydantic model representing the result of a settings update operation."""
    status: str
    message: str
    settings_path: str

def unmask_credential(new_val: Optional[str], old_val: str) -> str:
    """Unmasks sensitive credentials, handling literal escape sequences."""
    if new_val == "****":
        return old_val
    if new_val == "\\****":
        return "****"
    return new_val or ""

def merge_ai_settings(incoming_ai: Dict[str, Any], current_ai: Any) -> Dict[str, Any]:
    """Merges incoming AI settings with current state, preserving existing keys."""
    base_ai = current_ai.model_dump()
    
    # 1. Handle flat legacy fields if present
    if "api_key" in incoming_ai:
        incoming_ai["api_key"] = unmask_credential(incoming_ai.get("api_key"), current_ai.api_key)
        
    for key, val in incoming_ai.items():
        if val is None:
            continue
        if key == "api_key" and isinstance(val, str) and not val.strip():
            continue
        if key == "providers":
            continue
        base_ai[key] = val
        
    base_ai["model"] = _coerce_ai_model_for_provider(
        str(base_ai.get("provider") or "mock"),
        str(base_ai.get("model") or ""),
    )
    
    # 2. Handle providers registry array
    if "providers" in incoming_ai and isinstance(incoming_ai["providers"], list):
        merged_providers = []
        current_providers_map = {p.id: p for p in current_ai.providers} if hasattr(current_ai, "providers") else {}
        
        for p_dict in incoming_ai["providers"]:
            if not isinstance(p_dict, dict):
                continue
            p_id = p_dict.get("id")
            if p_id in current_providers_map:
                existing_p = current_providers_map[p_id]
                if "api_key" in p_dict:
                    p_dict["api_key"] = unmask_credential(p_dict.get("api_key"), existing_p.api_key)
            
            p_dict["model"] = _coerce_ai_model_for_provider(
                str(p_dict.get("provider") or "mock"),
                str(p_dict.get("model") or "")
            )
            merged_providers.append(p_dict)
            
        base_ai["providers"] = merged_providers
        
        # Also ensure flat fields mirror the priority 1 provider for backward compatibility
        if merged_providers:
            active_p = sorted(merged_providers, key=lambda x: x.get("priority", 999))[0]
            base_ai["provider"] = active_p.get("provider", "mock")
            base_ai["model"] = active_p.get("model", "gemini-2.0-flash-exp")
            base_ai["api_key"] = active_p.get("api_key", "")
    else:
        # If incoming_ai updated flat fields but NOT providers, we MUST sync the priority 1 provider in providers
        if base_ai.get("providers"):
            sorted_p = sorted(base_ai["providers"], key=lambda x: x.get("priority", 999))
            if sorted_p:
                sorted_p[0]["provider"] = base_ai.get("provider", "mock")
                sorted_p[0]["model"] = base_ai.get("model", "gemini-2.0-flash-exp")
                sorted_p[0]["api_key"] = base_ai.get("api_key", "")
                base_ai["providers"] = sorted_p
        else:
            base_ai["providers"] = [{
                "id": f"primary-{base_ai.get('provider', 'mock')}",
                "provider": base_ai.get("provider", "mock"),
                "model": base_ai.get("model", "gemini-2.0-flash-exp"),
                "api_key": base_ai.get("api_key", ""),
                "enabled": True,
                "priority": 1,
                "fallback_enabled": True
            }]
            
    return base_ai

def merge_platform_settings(incoming_platforms: Dict[str, Any], current_platforms: Any) -> Dict[str, Any]:
    """Merges incoming platform settings with current state."""
    base_platforms = current_platforms.model_dump()
    if "bluesky" in incoming_platforms:
        b = incoming_platforms["bluesky"]
        if "app_password" in b:
            b["app_password"] = unmask_credential(b.get("app_password"), current_platforms.bluesky.app_password)
        base_platforms["bluesky"].update(b)
            
    if "linkedin" in incoming_platforms:
        l = incoming_platforms["linkedin"]
        if "access_token" in l:
            l["access_token"] = unmask_credential(l.get("access_token"), current_platforms.linkedin.access_token)
        base_platforms["linkedin"].update(l)
            
    return base_platforms

def merge_all_settings(payload: Dict[str, Any], current_settings: Settings) -> Dict[str, Any]:
    """Merges all incoming configuration sections with the existing Settings state."""
    if "ingestion" in payload:
        if "hmac_secret" in payload["ingestion"]:
            payload["ingestion"]["hmac_secret"] = unmask_credential(payload["ingestion"]["hmac_secret"], current_settings.ingestion.hmac_secret)
        else:
            payload["ingestion"]["hmac_secret"] = current_settings.ingestion.hmac_secret
        if "max_payload_size" not in payload["ingestion"]:
            payload["ingestion"]["max_payload_size"] = current_settings.ingestion.max_payload_size
    else:
        payload["ingestion"] = current_settings.ingestion.model_dump()

    if "ai" in payload:
        payload["ai"] = merge_ai_settings(dict(payload["ai"]), current_settings.ai)
    else:
        payload["ai"] = current_settings.ai.model_dump()

    if "platforms" in payload:
        payload["platforms"] = merge_platform_settings(payload["platforms"], current_settings.platforms)
    else:
        payload["platforms"] = current_settings.platforms.model_dump()

    payload["database"] = current_settings.database.model_dump()

    if "ui" in payload:
        if "onboarding_complete" not in payload["ui"]:
            payload["ui"]["onboarding_complete"] = current_settings.ui.onboarding_complete
    else:
        payload["ui"] = current_settings.ui.model_dump()

    return payload

def persist_settings_to_disk(payload: Dict[str, Any], current_settings: Settings, settings_path: Path) -> SettingsUpdateResult:
    """Validates merged payload, writes settings.json to disk, and returns the result."""
    merged = merge_all_settings(payload, current_settings)
    try:
        updated_settings = Settings(**merged)
        with open(settings_path, "w") as f:
            json.dump(updated_settings.model_dump(mode='json'), f, indent=2)
        logger.info("settings.persisted", path=str(settings_path))
        return SettingsUpdateResult(status="saved", message="Settings saved and reloaded", settings_path=str(settings_path))
    except Exception as e:
        logger.error("settings.persist_failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

async def update_settings_service(payload: Dict[str, Any], current_settings: Settings, settings_path: Path) -> ActionResponse:
    """Service entry point for updating application settings."""
    res = persist_settings_to_disk(payload, current_settings, settings_path)
    return ActionResponse(status=res.status, message=res.message)
