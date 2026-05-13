"""LinkedIn platform adapter.

This module implements the publication logic for LinkedIn, including 
payload generation and secure dispatch via the LinkedIn API.
"""

import httpx
import structlog
from typing import Any, Dict, Optional
from core.models import VerifiedBuildFact

logger = structlog.get_logger()

class LinkedInAdapter:
    """Adapter for publishing facts to LinkedIn."""

    def __init__(
        self, 
        access_token: str, 
        author_urn: str,
        timeout: float = 10.0
    ):
        """Initializes the LinkedIn adapter.
        
        Args:
            access_token: LinkedIn OAuth2 access token.
            author_urn: The URN of the author (e.g., 'urn:li:person:abc' or 'urn:li:organization:123').
            timeout: Request timeout in seconds (default 10.0).
        """
        self.access_token = access_token
        self.author_urn = author_urn
        self.timeout = timeout
        self.api_url = "https://api.linkedin.com/v2/ugcPosts"
        
        # We use a persistent client if needed, but for isolation we'll use 
        # a local one in dispatch() or a shared one.
        
    async def authenticate(self) -> bool:
        """Verifies that the access token is valid.
        
        Returns:
            True if authentication is successful, False otherwise.
        """
        # In a real implementation, we would call /v2/me or similar
        # For now, we validate that credentials are provided.
        if not self.access_token or not self.author_urn:
            logger.error("linkedin.auth_failed", reason="Missing credentials")
            return False
            
        logger.info("linkedin.auth_success", author=self.author_urn)
        return True

    def generate_payload(self, fact: VerifiedBuildFact) -> Dict[str, Any]:
        """Formats a VerifiedBuildFact into a LinkedIn UGC Post payload.
        
        Args:
            fact: The fact to format.
            
        Returns:
            A dictionary matching the LinkedIn UGC API schema.
        """
        # Construct the visibility object
        visibility = "PUBLIC" # Hardcoded for now per constitutional simplicity
        
        # Format the text content
        text_content = f"{fact.summary}\n\n{fact.detail}\n\nRepo: {fact.source_repo}\nCommit: {fact.source_commit}"
        
        return {
            "author": self.author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": text_content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": visibility
            }
        }

    async def dispatch(self, fact: VerifiedBuildFact) -> bool:
        """Publishes the fact to LinkedIn.
        
        Args:
            fact: The verified fact to publish.
            
        Returns:
            True if published successfully, False otherwise.
        """
        log = logger.bind(fact_id=fact.id, platform="linkedin")
        
        payload = self.generate_payload(fact)
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers
                )
                
                if response.status_code in (200, 201):
                    log.info("linkedin.dispatch_success", status_code=response.status_code)
                    return True
                else:
                    log.error(
                        "linkedin.dispatch_failed", 
                        status_code=response.status_code, 
                        response=response.text
                    )
                    return False
                    
        except httpx.RequestError as e:
            log.error("linkedin.network_error", error=str(e))
            return False
        except Exception as e:
            log.error("linkedin.unexpected_error", error=str(e))
            return False
