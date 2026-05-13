"""Bluesky platform adapter using AT Protocol.

This module implements the publication logic for Bluesky, including 
session management and post generation.
"""

import structlog
from typing import Any, Dict, List, Optional
from atproto import Client, models
from core.models import VerifiedBuildFact, FactType

logger = structlog.get_logger()

class BlueskyAdapter:
    """Adapter for publishing facts to Bluesky."""

    def __init__(
        self, 
        handle: str, 
        app_password: str,
        dry_run: bool = False
    ):
        """Initializes the Bluesky adapter.
        
        Args:
            handle: Bluesky handle (e.g., 'user.bsky.social').
            app_password: App-specific password.
            dry_run: If True, skips actual API calls.
        """
        self.handle = handle
        self.app_password = app_password
        self.dry_run = dry_run
        self.client = Client()
        self._authenticated = False

    async def authenticate(self) -> bool:
        """Log in to Bluesky via AT Protocol.
        
        Returns:
            True if login is successful, False otherwise.
        """
        if self._authenticated:
            return True

        if not self.handle or not self.app_password:
            logger.error("bluesky.auth_failed", reason="Missing credentials")
            return False

        try:
            # atproto login is synchronous, but we're in an async context
            # In a production app, we might use a thread pool
            self.client.login(self.handle, self.app_password)
            self._authenticated = True
            logger.info("bluesky.auth_success", handle=self.handle)
            return True
        except Exception as e:
            logger.error("bluesky.auth_failed", error=str(e))
            return False

    def generate_payload(self, fact: VerifiedBuildFact) -> Dict[str, Any]:
        """Creates the post text for Bluesky.
        
        Args:
            fact: The verified fact to publish.
            
        Returns:
            A dictionary containing the post text.
        """
        hashtags = {
            FactType.BUILD_SUCCESS: "#BuildSuccess #CI",
            FactType.BUILD_FAILURE: "#BuildFailure #DevOps",
            FactType.TEST_PASS: "#Testing #Quality",
            FactType.FEATURE_ADDED: "#NewFeature #Shipping",
            FactType.BUG_FIXED: "#BugFix #Engineering",
            FactType.SECURITY_VULNERABILITY: "#Security #CyberSecurity"
        }
        
        tag = hashtags.get(fact.fact_type, "#ProofPost")
        text = f"{fact.summary}\n\n{tag}"
        
        # Max 300 characters for Bluesky
        if len(text) > 300:
            text = text[:297] + "..."
            
        return {"text": text}

    async def dispatch(self, fact: VerifiedBuildFact) -> Dict[str, Any]:
        """Publishes the fact to Bluesky.
        
        Args:
            fact: The verified fact to publish.
            
        Returns:
            A dictionary with success, url, and error information.
        """
        log = logger.bind(fact_id=fact.id, platform="bluesky")
        
        payload = self.generate_payload(fact)
        
        if self.dry_run:
            log.info("bluesky.dry_run_skip", text=payload["text"])
            return {
                "success": True, 
                "url": f"https://bsky.app/profile/{self.handle}/post/mock", 
                "error": None
            }

        if not await self.authenticate():
            return {"success": False, "url": None, "error": "Authentication failed"}

        try:
            # atproto send_post is synchronous
            response = self.client.send_post(text=payload["text"])
            
            # Construct the post URL (simplified)
            # uri format: at://did:plc:xxx/app.bsky.feed.post/yyy
            post_id = response.uri.split("/")[-1]
            url = f"https://bsky.app/profile/{self.handle}/post/{post_id}"
            
            log.info("bluesky.dispatch_success", uri=response.uri)
            return {"success": True, "url": url, "error": None}
            
        except Exception as e:
            error_msg = str(e)
            log.error("bluesky.dispatch_failed", error=error_msg)
            return {"success": False, "url": None, "error": error_msg}