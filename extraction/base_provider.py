"""Base interface for LLM fact extraction providers.

This module defines the abstract interface that all LLM extraction 
providers must implement to be used by the extraction orchestration layer.
"""

from typing import Any, Dict, List
from core.models import VerifiedBuildFact

class BaseLLMProvider:
    """Abstract base interface for LLM fact extraction providers."""

    async def extract_facts(
        self, payload: Dict[str, Any]
    ) -> List[VerifiedBuildFact]:
        """Extracts structured facts from a raw webhook payload.
        
        Args:
            payload: Raw webhook payload dictionary.
            
        Returns:
            List of VerifiedBuildFact instances.
            
        Raises:
            NotImplementedError: Must be implemented by subclasses.
        """
        raise NotImplementedError

    async def get_available_models(self) -> List[str]:
        """Returns a list of available model IDs for this provider."""
        return []
