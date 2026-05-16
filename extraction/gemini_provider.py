"""Gemini LLM provider for fact extraction.

This module implements the Gemini-based fact extraction provider using 
the new google-genai SDK, utilizing async calls to prevent event loop blocking.
"""

import json
import uuid
import asyncio
import structlog
from google import genai
from typing import Any, Dict, List, Optional
from core.models import VerifiedBuildFact, FactType
from extraction.base_provider import BaseLLMProvider

logger = structlog.get_logger()

class GeminiProvider(BaseLLMProvider):
    """LLM provider using Google's Gemini models via the new google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        """Initializes the Gemini provider.
        
        Args:
            api_key: Google AI Studio API key.
            model: Gemini model identifier.
        """
        self.api_key = api_key
        self.model_name = model
        
        # Initialize the new SDK client
        self.client = genai.Client(api_key=self.api_key)

    def _extract_metadata(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """Extracts common metadata (repo, commit, event_id) from GitHub payload."""
        repo = (
            payload.get("repository", {}).get("full_name") or 
            payload.get("repository", {}).get("html_url") or 
            "unknown/repo"
        )
        
        commit = (
            payload.get("after") or 
            payload.get("pull_request", {}).get("head", {}).get("sha") or 
            payload.get("sha") or 
            "unknown"
        )
        
        event_id = str(payload.get("id") or uuid.uuid4())
        
        return {
            "repo": repo,
            "commit": commit,
            "event_id": event_id
        }

    def _map_fact_type(self, raw_type: str) -> FactType:
        """Maps Gemini extracted fact types to the internal FactType enum."""
        mapping = {
            "feature_added": FactType.FEATURE_ADDED,
            "bug_fixed": FactType.BUG_FIXED,
            "performance_gain": FactType.PERFORMANCE_IMPROVED,
            "security_fix": FactType.SECURITY_VULNERABILITY,
            "refactor": FactType.REFACTOR_COMPLETED,
            "dependency_update": FactType.DEPENDENCY_UPDATE,
            "breaking_change": FactType.BREAKING_CHANGE,
            "docs_updated": FactType.DOCS_UPDATED,
        }
        
        raw_clean = raw_type.lower().strip()
        return mapping.get(raw_clean, FactType.FEATURE_ADDED)

    async def extract_facts(self, payload: Dict[str, Any]) -> List[VerifiedBuildFact]:
        """Extracts structured facts from a raw webhook payload using Gemini.
        
        Args:
            payload: Raw webhook payload dictionary.
            
        Returns:
            List of VerifiedBuildFact instances. Empty list on failure.
        """
        metadata = self._extract_metadata(payload)
        
        prompt = f"""
Extract engineering facts from this GitHub webhook payload.
For each fact, summarize the actual technical change with specificity.
Avoid generic marketing phrases (e.g., 'Enhanced user experience', 'New feature added').
Focus on 'What' and 'How' (e.g., 'Implemented JWT-based authentication with bcrypt password hashing' or 'Optimized SQL queries by adding composite indices on user_id and created_at').

Return only facts directly supported by text in the payload.
For each fact provide: fact_type, summary, source_snippet, detail.
fact_type must be one of: feature_added, bug_fixed, 
performance_gain, breaking_change, security_fix, refactor,
docs_updated, dependency_update

Payload:
{json.dumps(payload, indent=2)}

Return a JSON list of objects with the specified fields.
"""
        try:
            # Use the async client (aio) to prevent blocking the event loop.
            # We also implement a 15-second timeout for robustness.
            response = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json"
                    }
                ),
                timeout=15.0
            )
            
            if not response.text:
                logger.warning("gemini_provider.empty_response")
                return []
                
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()
                
            try:
                raw_facts = json.loads(text)
            except json.JSONDecodeError:
                logger.error("gemini_provider.json_parse_error", text=text)
                return []

            if not isinstance(raw_facts, list):
                raw_facts = [raw_facts]
                
            verified_facts = []
            for item in raw_facts:
                try:
                    ft_raw = item.get("fact_type", "feature_added")
                    ft_mapped = self._map_fact_type(ft_raw)
                    
                    fact = VerifiedBuildFact(
                        id=f"fact_{uuid.uuid4().hex[:8]}",
                        source_event_id=metadata["event_id"],
                        fact_type=ft_mapped,
                        summary=item.get("summary", "No summary provided"),
                        detail=item.get("detail", "No detail provided"),
                        source_repo=metadata["repo"],
                        source_commit=metadata["commit"],
                        source_snippet=item.get("source_snippet"),
                        confidence_score=0.9,
                        verification_status="pending"
                    )
                    verified_facts.append(fact)
                except Exception as e:
                    logger.warning("gemini_provider.fact_validation_error", error=str(e), item=item)
                    continue
            
            logger.info("gemini_provider.extraction_success", count=len(verified_facts))
            return verified_facts

        except asyncio.TimeoutError:
            logger.error("gemini_provider.timeout", timeout=15.0)
            return []
        except Exception as e:
            logger.error("gemini_provider.api_failure", error=str(e))
            return []

    async def get_available_models(self) -> List[str]:
        """Returns a list of available Gemini model IDs via the active SDK client."""
        try:
            models = []
            async for m in self.client.aio.models.list():
                if m.name and "gemini" in m.name.lower():
                    name = m.name.replace("models/", "")
                    models.append(name)
            return models if models else ["gemini-2.5-pro", "gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"]
        except Exception as e:
            logger.warning("gemini_provider.list_models_failed", error=str(e))
            return ["gemini-2.5-pro", "gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"]
