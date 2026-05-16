"""NVIDIA NIM LLM provider for fact extraction.

This module implements the NVIDIA NIM-based fact extraction provider using
httpx, utilizing async calls to prevent event loop blocking.
"""

import json
import uuid
import asyncio
import structlog
import httpx
from typing import Any, Dict, List, Optional
from core.models import VerifiedBuildFact, FactType
from extraction.base_provider import BaseLLMProvider

logger = structlog.get_logger()

class NvidiaProvider(BaseLLMProvider):
    """LLM provider using NVIDIA NIM models via httpx."""

    def __init__(self, api_key: str, model: str = "meta/llama-3.1-70b-instruct"):
        """Initializes the NVIDIA NIM provider.
        
        Args:
            api_key: NVIDIA NIM API key (nvapi-...).
            model: NVIDIA NIM model identifier.
        """
        self.api_key = api_key
        self.model_name = model
        self.base_url = "https://integrate.api.nvidia.com/v1/chat/completions"

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
        """Maps NVIDIA extracted fact types to the internal FactType enum."""
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
        """Extracts structured facts from a raw webhook payload using NVIDIA NIM.
        
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
            import asyncio
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            payload = json.dumps({
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": "You are an engineering fact extractor. You return ONLY raw JSON."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"}
            }).encode("utf-8")
            
            def _post():
                import urllib.request
                import urllib.error
                req = urllib.request.Request(self.base_url, headers=headers, data=payload)
                try:
                    with urllib.request.urlopen(req, timeout=15.0) as res:
                        return res.getcode(), res.read().decode("utf-8")
                except urllib.error.HTTPError as e:
                    return e.getcode(), e.read().decode("utf-8")
                    
            status_code, body_text = await asyncio.to_thread(_post)
            if status_code != 200:
                logger.error("nvidia_provider.http_error", status_code=status_code, text=body_text)
                return []
                
            data = json.loads(body_text)
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not content:
                logger.warning("nvidia_provider.empty_response")
                return []
                
            text = content.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()
            
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    if "facts" in parsed and isinstance(parsed["facts"], list):
                        raw_facts = parsed["facts"]
                    else:
                        raw_facts = [parsed]
                elif isinstance(parsed, list):
                    raw_facts = parsed
                else:
                    logger.error("nvidia_provider.unexpected_format", text=text)
                    return []
            except json.JSONDecodeError:
                logger.error("nvidia_provider.json_parse_error", text=text)
                return []

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
                    logger.warning("nvidia_provider.fact_validation_error", error=str(e), item=item)
                    continue
            
            logger.info("nvidia_provider.extraction_success", count=len(verified_facts))
            return verified_facts

        except Exception as e:
            logger.error("nvidia_provider.api_failure", error=str(e))
            return []

    async def get_available_models(self) -> List[str]:
        """Fetches live available models from NVIDIA NIM API."""
        try:
            import asyncio
            
            def _get():
                import urllib.request
                import urllib.error
                req = urllib.request.Request(
                    "https://integrate.api.nvidia.com/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=10.0) as res:
                        return res.getcode(), res.read().decode("utf-8")
                except urllib.error.HTTPError as e:
                    return e.getcode(), e.read().decode("utf-8")
                    
            status_code, body_text = await asyncio.to_thread(_get)
            if status_code == 200:
                data = json.loads(body_text)
                models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                logger.info("nvidia_provider.models_fetched", count=len(models))
                return models
            logger.warning("nvidia_provider.models_fetch_failed", status_code=status_code, text=body_text)
            return []
        except Exception as e:
            logger.error("nvidia_provider.models_fetch_error", error=str(e))
            return []
