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
    error: Optional[str] = None

class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int

class PlatformStatus(BaseModel):
    id: str
    name: str
    connected: bool
    handle: Optional[str] = Field(None, description="Display handle when connected (never secrets)")
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

class AIProviderConfigResponse(BaseModel):
    id: str
    provider: str
    model: str
    api_key: str
    enabled: bool
    priority: int
    fallback_enabled: bool

class AIProvidersListResponse(BaseModel):
    providers: List[AIProviderConfigResponse]

class AIProvidersSaveRequest(BaseModel):
    providers: List[AIProviderConfigResponse]

class AIProvidersSaveResponse(BaseModel):
    success: bool
    data: AIProvidersListResponse

class AIProviderReorderRequest(BaseModel):
    provider_ids: List[str]

class AIProviderModelsResponse(BaseModel):
    provider: str
    models: List[str]
    default_model: str

class AISettingsResponse(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: str
    providers: Optional[List[AIProviderConfigResponse]] = None

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

class UISettingsResponse(BaseModel):
    onboarding_complete: bool

class SettingsResponse(BaseModel):
    ingestion: IngestionSettingsResponse
    ai: AISettingsResponse
    platforms: PlatformSettingsResponse
    ui: UISettingsResponse
    dev_mode: bool
    dry_run: bool

class WebhookResponse(BaseModel):
    status: str
    facts_extracted: int
    facts_verified: int
    trace_id: str

class PipelineEvent(BaseModel):
    id: str
    session_id: str
    event_type: str
    timestamp: str
    status: str
    detail: Optional[str] = None
    duration_ms: Optional[int] = None
    fact_id: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[PipelineEvent]
    total: int

class PreviewResponse(BaseModel):
    fact_id: str
    platform: str
    preview_text: str
    char_count: int
    char_limit: int
    within_limit: bool

class TestAIRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = "gemini-2.0-flash-exp"

class TestAIResponse(BaseModel):
    success: bool
    provider: str
    message: str
    model_confirmed: Optional[str] = None
    latency_ms: Optional[int] = None

class NgrokStatusResponse(BaseModel):
    connected: bool
    public_url: Optional[str] = None

class AIStatusResponse(BaseModel):
    working_provider: Optional[str] = None
    working_model: Optional[str] = None
    working_id: Optional[str] = None
    total_enabled: int = 0
    failover_chain: List[str] = []
