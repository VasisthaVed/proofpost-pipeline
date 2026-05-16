"""AI testing service for verifying provider credentials and models."""

import time
import structlog
from typing import Optional
from pydantic import BaseModel
from core.config import Settings, AISettings
from extraction.extractor import create_provider
import core.main
from schemas.responses import TestAIRequest, TestAIResponse

logger = structlog.get_logger()

class AITestExecutionResult(BaseModel):
    """Pydantic model representing the result of an AI test execution."""
    success: bool
    provider: str
    message: str
    model_confirmed: Optional[str] = None
    latency_ms: Optional[int] = None

def resolve_test_api_key(request: TestAIRequest, current_settings: Settings, config_id: str = "") -> str:
    """Resolves the raw API key, handling masking and local mock defaults."""
    raw_key = (request.api_key or "").strip()
    if raw_key in ("", "****"):
        if config_id and hasattr(current_settings.ai, "providers") and current_settings.ai.providers:
            for p in current_settings.ai.providers:
                if p.id == config_id and p.api_key and p.api_key != "****":
                    return p.api_key
        if current_settings.ai.provider == request.provider and current_settings.ai.api_key:
            raw_key = current_settings.ai.api_key
        elif request.provider == "mock":
            raw_key = "mock-local"
    elif raw_key == "\\****":
        raw_key = "****"
    return raw_key

class TempSettings:
    """Temporary settings wrapper for provider initialization."""
    def __init__(self, ai: AISettings):
        self.ai = ai

async def execute_provider_test(
    provider_name: str,
    api_key: str,
    model_name: Optional[str],
    config_id: str = ""
) -> AITestExecutionResult:
    """Executes a real test generation call against the AI provider."""
    start = time.time()
    from core.config import AIProviderConfig
    from extraction.provider_factory import ProviderFactory
    
    cfg = AIProviderConfig(
        id=config_id or f"test-{provider_name}",
        provider=provider_name,
        model=model_name or "gemini-2.0-flash-exp",
        api_key=api_key,
        priority=1
    )
    
    try:
        provider = ProviderFactory.create(cfg)
        await core.main.generate_with_provider(provider, "Reply with 'OK' and nothing else.")
        latency = int((time.time() - start) * 1000)
        return AITestExecutionResult(
            success=True,
            provider=provider_name,
            message="Connected successfully",
            model_confirmed=model_name,
            latency_ms=latency
        )
    except Exception as e:
        from core.main import plain_english_error
        return AITestExecutionResult(
            success=False,
            provider=provider_name,
            message=plain_english_error(e),
            model_confirmed=None,
            latency_ms=None
        )

async def test_ai_connection_service(request: TestAIRequest, current_settings: Settings, config_id: str = "") -> TestAIResponse:
    """Service entry point for testing AI provider connections."""
    raw_key = resolve_test_api_key(request, current_settings, config_id)
    res = await execute_provider_test(request.provider, raw_key, request.model, config_id)
    return TestAIResponse(
        success=res.success,
        provider=res.provider,
        message=res.message,
        model_confirmed=res.model_confirmed,
        latency_ms=res.latency_ms
    )
