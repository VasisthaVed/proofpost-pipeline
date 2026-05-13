"""Fact extraction orchestration layer.

This module coordinates the extraction of VerifiedBuildFact objects from
raw payloads using a pluggable LLM provider with timeout and error handling.
"""

import asyncio
import structlog
import uuid
from typing import Any, Dict, List, Optional
from core.models import VerifiedBuildFact
from core.config import AISettings
from extraction.base_provider import BaseLLMProvider

logger = structlog.get_logger()

class Extractor:
    """Orchestrates fact extraction using a provided LLM provider."""

    def __init__(self, provider: BaseLLMProvider, timeout: int = 15):
        """Initializes the extractor with a provider and timeout.
        
        Args:
            provider: An implementation of BaseLLMProvider.
            timeout: Maximum seconds to wait for extraction (default 10).
        """
        self.provider = provider
        self.timeout = timeout

    async def extract(
        self, 
        payload: Dict[str, Any]
    ) -> List[VerifiedBuildFact]:
        """Extracts structured facts from a raw payload.
        
        Args:
            payload: Raw webhook or artifact payload.
            
        Returns:
            List of validated VerifiedBuildFact instances. Returns empty list 
            on timeout, provider failure, or invalid data.
        """
        # Attempt to get a trace_id from the payload or generate a new one
        trace_id = payload.get("source_event_id") or payload.get("id") or str(uuid.uuid4())
        
        log = logger.bind(trace_id=trace_id)
        
        try:
            # Enforce timeout
            facts = await asyncio.wait_for(
                self.provider.extract_facts(payload), 
                timeout=self.timeout
            )
            
            # 2. Fact Quality Filtering & Deduplication
            # We filter out facts with empty summaries and ensure no duplicates in the same batch
            seen_summaries = set()
            valid_facts = []
            
            for fact in facts:
                if not isinstance(fact, VerifiedBuildFact):
                    log.warning("extractor.invalid_object_type", received_type=type(fact))
                    continue
                
                # Added quality signal: Drop facts with suspiciously short or empty summaries
                if len(fact.summary.strip()) < 10:
                    log.warning("extractor.fact_too_short", fact_id=fact.id, summary=fact.summary)
                    continue

                # Added batch deduplication: Prevent multiple similar posts from one payload
                summary_hash = fact.summary.lower().strip()
                if summary_hash in seen_summaries:
                    log.info("extractor.duplicate_fact_dropped", summary=fact.summary)
                    continue
                
                seen_summaries.add(summary_hash)
                valid_facts.append(fact)
            
            log.info("extractor.success", fact_count=len(valid_facts))
            return valid_facts

        except asyncio.TimeoutError:
            log.error("extractor.timeout", timeout_seconds=self.timeout)
            return []
        except Exception as e:
            log.error("extractor.failure", error=str(e))
            return []

def create_provider(settings: Any) -> BaseLLMProvider:
    """Factory function to create an LLM provider based on settings."""
    if settings.ai.provider == "gemini":
        from extraction.gemini_provider import GeminiProvider
        return GeminiProvider(settings.ai.api_key, settings.ai.model)
    
    if settings.ai.provider == "groq":
        from extraction.groq_provider import GroqProvider
        return GroqProvider(settings.ai.api_key, settings.ai.model)
    
    from extraction.mock_provider import MockLLMProvider
    return MockLLMProvider()