"""Mock LLM provider for testing and development.

This module provides a deterministic fake implementation of the LLM
extraction interface, returning hardcoded VerifiedBuildFact instances
for use in tests without any real HTTP calls.
"""

import structlog
from typing import Any, Dict, List
from core.models import VerifiedBuildFact, FactType
from extraction.base_provider import BaseLLMProvider

logger = structlog.get_logger()


class MockLLMProvider(BaseLLMProvider):
    """Deterministic mock provider that returns hardcoded facts.
    
    Returns exactly 2 VerifiedBuildFact instances for any input.
    The source_snippet for each fact is extracted as a substring
    from the payload's text content.
    """

    def _extract_snippet(self, payload: Dict[str, Any], max_len: int = 50) -> str:
        """Extracts a snippet from the first string value found in the payload.
        
        Args:
            payload: The raw payload dictionary.
            max_len: Maximum length of the returned snippet.
            
        Returns:
            A substring of the first string value found, or empty string.
        """
        for value in payload.values():
            if isinstance(value, str) and len(value) > 0:
                return value[:max_len]
        return ""

    async def extract_facts(
        self, payload: Dict[str, Any]
    ) -> List[VerifiedBuildFact]:
        """Returns 2 deterministic hardcoded VerifiedBuildFact instances.
        
        Args:
            payload: Raw webhook payload dictionary.
            
        Returns:
            List containing exactly 2 VerifiedBuildFact instances.
        """
        snippet = self._extract_snippet(payload)
        
        facts = [
            VerifiedBuildFact(
                id="mock_fact_1",
                source_event_id="mock_event_1",
                fact_type=FactType.FEATURE_ADDED,
                summary="Feature added: new capability deployed",
                detail="A new feature was successfully built and deployed.",
                source_repo="https://github.com/mock/repo",
                source_commit="aaa111bbb222",
                source_snippet=snippet if snippet else None,
                confidence_score=0.95,
            ),
            VerifiedBuildFact(
                id="mock_fact_2",
                source_event_id="mock_event_2",
                fact_type=FactType.BUG_FIXED,
                summary="Bug fixed: all regression tests now pass",
                detail="A critical bug was fixed and verified by passing tests.",
                source_repo="https://github.com/mock/repo",
                source_commit="ccc333ddd444",
                source_snippet=snippet if snippet else None,
                confidence_score=0.90,
            ),
        ]
        
        logger.info("mock_provider.extracted", count=len(facts))
        return facts

    async def get_available_models(self) -> List[str]:
        """Returns a list of mock model IDs."""
        return ["mock", "mock-reasoning", "mock-fast"]