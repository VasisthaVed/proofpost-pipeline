"""Fact extraction orchestration layer.

This module coordinates the extraction of VerifiedBuildFact objects from
raw payloads using a pluggable LLM provider with timeout and error handling.
"""

import asyncio
import structlog
import uuid
from typing import Any, Dict, List, Optional
from core.models import VerifiedBuildFact
from core.config import AISettings, AIProviderConfig
from extraction.base_provider import BaseLLMProvider
from extraction.provider_factory import ProviderFactory

logger = structlog.get_logger()

class Extractor:
    """Orchestrates fact extraction using a provided LLM provider or multi-provider failover chain."""

    def __init__(self, provider: Optional[BaseLLMProvider] = None, settings: Optional[Any] = None, timeout: int = 15):
        """Initializes the extractor with a legacy provider, settings object, and timeout.
        
        Args:
            provider: Legacy single implementation of BaseLLMProvider.
            settings: Root Settings or AISettings object containing providers registry.
            timeout: Maximum seconds to wait per provider extraction (default 15).
        """
        self.provider = provider
        if settings is None:
            try:
                from core.main import state
                if hasattr(state, "settings") and state.settings:
                    settings = state.settings
            except Exception:
                pass
        self.settings = settings
        self.timeout = timeout

    async def extract(
        self, 
        payload: Dict[str, Any]
    ) -> List[VerifiedBuildFact]:
        """Extracts structured facts from a raw payload using deterministic failover.
        
        Args:
            payload: Raw webhook or artifact payload.
            
        Returns:
            List of validated VerifiedBuildFact instances. Returns empty list 
            on timeout, provider failure, or invalid data across the entire failover chain.
        """
        trace_id = payload.get("source_event_id") or payload.get("id") or str(uuid.uuid4())
        log = logger.bind(trace_id=trace_id)
        
        # 1. Determine candidate provider configurations
        candidates: List[Any] = []
        
        if self.provider:
            candidates = [self.provider]
        elif self.settings and hasattr(self.settings, "ai") and hasattr(self.settings.ai, "providers") and self.settings.ai.providers:
            candidates = [p for p in sorted(self.settings.ai.providers, key=lambda x: getattr(x, "priority", 999)) if getattr(p, "enabled", True)]
        elif self.settings and hasattr(self.settings, "providers") and self.settings.providers: # If passed AISettings directly
            candidates = [p for p in sorted(self.settings.providers, key=lambda x: getattr(x, "priority", 999)) if getattr(p, "enabled", True)]
        else:
            # Fallback to mock
            from extraction.mock_provider import MockLLMProvider
            candidates = [MockLLMProvider()]

        if not candidates:
            log.error("extractor.no_enabled_providers")
            return []

        # 2. Deterministic Failover Execution Loop
        for i, candidate in enumerate(candidates):
            p_id = getattr(candidate, "id", f"legacy-provider-{i}")
            p_name = getattr(candidate, "provider", "legacy")
            is_primary = (i == 0)
            
            # Check failover authorization for secondary candidates
            if not is_primary and not getattr(candidate, "fallback_enabled", True):
                log.info("extractor.candidate_fallback_disabled_skipping", id=p_id, provider=p_name)
                continue

            log_step = log.bind(provider_id=p_id, provider_name=p_name, failover_attempt=i)
            log_step.info("extractor.attempting_extraction")

            try:
                # Instantiate concrete provider if candidate is a config object
                if isinstance(candidate, BaseLLMProvider):
                    active_provider = candidate
                else:
                    active_provider = ProviderFactory.create(candidate)

                # Enforce timeout per provider
                facts = await asyncio.wait_for(
                    active_provider.extract_facts(payload), 
                    timeout=self.timeout
                )
                
                # Fact Quality Filtering & Deduplication
                seen_summaries = set()
                valid_facts = []
                
                for fact in facts:
                    if not isinstance(fact, VerifiedBuildFact):
                        log_step.warning("extractor.invalid_object_type", received_type=type(fact))
                        continue
                    
                    if len(fact.summary.strip()) < 10:
                        log_step.warning("extractor.fact_too_short", fact_id=fact.id, summary=fact.summary)
                        continue

                    summary_hash = fact.summary.lower().strip()
                    if summary_hash in seen_summaries:
                        log_step.info("extractor.duplicate_fact_dropped", summary=fact.summary)
                        continue
                    
                    seen_summaries.add(summary_hash)
                    valid_facts.append(fact)
                
                log_step.info("extractor.success", fact_count=len(valid_facts))
                return valid_facts

            except asyncio.TimeoutError:
                log_step.error("extractor.timeout", timeout_seconds=self.timeout)
                # Continue to next candidate
            except Exception as e:
                log_step.error("extractor.failure", error=str(e))
                # Continue to next candidate

        # If entire chain exhausted
        log.error("extractor.chain_exhausted")
        return []

def create_provider(settings: Any) -> BaseLLMProvider:
    """Factory function to create an LLM provider based on settings (legacy wrapper delegating to ProviderFactory)."""
    # If settings has ai.providers, use the first enabled one
    if hasattr(settings, "ai") and hasattr(settings.ai, "providers") and settings.ai.providers:
        active_p = sorted(settings.ai.providers, key=lambda x: getattr(x, "priority", 999))[0]
        return ProviderFactory.create(active_p)
    
    # Fallback to flat settings
    p_name = getattr(settings.ai, "provider", "mock") if hasattr(settings, "ai") else "mock"
    model = getattr(settings.ai, "model", "gemini-2.0-flash-exp") if hasattr(settings, "ai") else "gemini-2.0-flash-exp"
    api_key = getattr(settings.ai, "api_key", "") if hasattr(settings, "ai") else ""
    cfg = AIProviderConfig(id=f"primary-{p_name}", provider=p_name, model=model, api_key=api_key, priority=1)
    return ProviderFactory.create(cfg)