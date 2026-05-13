from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str = Field("ok", json_schema_extra={"example": "ok"})
    timestamp: str = Field(..., json_schema_extra={"example": "12345.67"})
    db: bool = Field(True, json_schema_extra={"example": True})
    ai: bool = Field(True, json_schema_extra={"example": True})
    dry_run: bool = Field(True, json_schema_extra={"example": True})
    queue: Dict[str, int] = Field(..., json_schema_extra={"example": {"pending": 0, "dispatched": 0}})

class FactResponse(BaseModel):
    id: str
    fact_type: str
    summary: str
    source_snippet: str
    source_repo: str
    source_commit: str
    source_pr_id: Optional[str] = None
    verification_status: str
    confidence_score: float
    created_at: datetime
    status: str = Field("pending", json_schema_extra={"example": "pending"})

class PendingQueueResponse(BaseModel):
    items: List[FactResponse]
    total: int

class ActionResponse(BaseModel):
    status: str = Field("success", json_schema_extra={"example": "success"})
    message: Optional[str] = None
    id: Optional[str] = None

class HistoryItem(BaseModel):
    id: str
    created_at: datetime
    platform: str
    summary: str
    status: str
    url: Optional[str] = None

class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int

class PlatformStatus(BaseModel):
    id: str
    name: str
    connected: bool
    last_tested: Optional[datetime] = None
    last_error: Optional[str] = None

class PlatformsResponse(BaseModel):
    platforms: List[PlatformStatus]

class TestPlatformResponse(BaseModel):
    status: str
    connected: bool
    message: Optional[str] = None

class IngestionSettingsResponse(BaseModel):
    hmac_secret: Optional[str] = None
    max_payload_size: int

class AISettingsResponse(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: str

class BlueskySettingsResponse(BaseModel):
    enabled: bool
    handle: str
    app_password: Optional[str] = None

class LinkedInSettingsResponse(BaseModel):
    enabled: bool
    access_token: Optional[str] = None

class PlatformSettingsResponse(BaseModel):
    bluesky: BlueskySettingsResponse
    linkedin: LinkedInSettingsResponse

class SettingsResponse(BaseModel):
    ingestion: IngestionSettingsResponse
    ai: AISettingsResponse
    platforms: PlatformSettingsResponse
    dev_mode: bool
    dry_run: bool

class WebhookResponse(BaseModel):
    status: str
    facts_extracted: int
    facts_verified: int
    trace_id: str
