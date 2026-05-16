"""Single authoritative factory for AI extraction providers.

Centralizes instantiation, model coercion, unmasking resolution, timeout wrapping,
and standardized error handling across all AI subsystems.
"""

import os
import structlog
from typing import Any, Dict, Optional
from core.config import AIProviderConfig
from extraction.base_provider import BaseLLMProvider

logger = structlog.get_logger()

DEFAULT_MODELS = {
    "gemini": "gemini-2.5-pro",
    "groq": "llama-3.3-70b-versatile",
    "nvidia": "meta/llama-3.1-70b-instruct",
    "openrouter": "openrouter/auto",
    "mock": "mock"
}

KNOWN_MODELS = {
    "gemini": ["gemini-2.5-pro", "gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    "groq": ["llama-3.3-70b-versatile", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"],
    "nvidia": ["meta/llama-3.1-70b-instruct", "meta/llama-3.3-70b-instruct", "nvidia/nemotron-4-340b-instruct"],
    "openrouter": ["openrouter/auto", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct"],
    "mock": ["mock", "mock-reasoning", "mock-fast"]
}

class ProviderFactory:
    """Authoritative factory for instantiating and wrapping AI providers."""

    @staticmethod
    def _coerce_model(provider: str, model: str) -> str:
        """Coerces model ID to ensure valid provider-model pairings."""
        defaults = {
            "gemini": "gemini-2.0-flash-exp",
            "groq": "llama3-8b-8192",
            "nvidia": "meta/llama-3.3-70b-instruct",
            "openrouter": "openrouter/auto",
            "mock": "mock"
        }
        pl = (provider or "mock").strip().lower()
        m = (model or "").strip()
        if pl == "groq":
            if not m or "gemini" in m.lower():
                return defaults["groq"]
            return m
        if pl == "gemini":
            if not m or ("llama" in m.lower() and "gemini" not in m.lower()):
                return defaults["gemini"]
            return m
        if pl == "nvidia":
            return m or defaults["nvidia"]
        if pl == "openrouter":
            return m or defaults["openrouter"]
        if pl == "mock":
            return m or defaults["mock"]
        return defaults.get("mock", "mock")

    @staticmethod
    def _resolve_api_key(provider: str, api_key: str, config_id: str = "") -> str:
        """Resolves masked API keys against active runtime memory or environment variables."""
        if api_key and api_key != "****":
            return api_key
            
        # Check active memory settings if masked
        try:
            from core.main import state
            if hasattr(state, "settings") and state.settings and hasattr(state.settings, "ai"):
                # If matching by config_id
                if config_id and hasattr(state.settings.ai, "providers") and state.settings.ai.providers:
                    for p in state.settings.ai.providers:
                        if p.id == config_id and p.api_key and p.api_key != "****":
                            return p.api_key
                # Fallback to flat api_key
                if hasattr(state.settings.ai, "api_key") and state.settings.ai.api_key and state.settings.ai.api_key != "****":
                    return state.settings.ai.api_key
        except Exception as e:
            logger.debug("provider_factory.memory_unmask_failed", error=str(e))

        # Check environment overrides as final fallback
        env_map = {
            "gemini": "GEMINI_API_KEY",
            "groq": "GROQ_API_KEY",
            "nvidia": "NVIDIA_API_KEY",
            "openrouter": "OPENROUTER_API_KEY"
        }
        env_var = env_map.get(provider.lower().strip())
        if env_var and os.environ.get(env_var):
            return os.environ.get(env_var)
            
        return api_key

    @classmethod
    def create(cls, config: AIProviderConfig) -> BaseLLMProvider:
        """Instantiates a concrete BaseLLMProvider from an AIProviderConfig."""
        p_type = config.provider.lower().strip()
        model = cls._coerce_model(p_type, config.model)
        api_key = cls._resolve_api_key(p_type, config.api_key, config.id)

        logger.info("provider_factory.instantiating", id=config.id, provider=p_type, model=model)

        if p_type == "gemini":
            from extraction.gemini_provider import GeminiProvider
            return GeminiProvider(api_key=api_key, model=model)
        elif p_type == "groq":
            from extraction.groq_provider import GroqProvider
            return GroqProvider(api_key=api_key, model=model)
        elif p_type == "nvidia":
            from extraction.nvidia_provider import NvidiaProvider
            return NvidiaProvider(api_key=api_key, model=model)
        elif p_type == "openrouter":
            from extraction.openrouter_provider import OpenRouterProvider
            return OpenRouterProvider(api_key=api_key, model=model)
        else:
            from extraction.mock_provider import MockLLMProvider
            return MockLLMProvider()
