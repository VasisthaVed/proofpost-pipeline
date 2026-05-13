"""Pydantic models for the ProofPost publishing pipeline.

This module defines the core data structures used throughout the system,
including the VerifiedBuildFact schema for representing verified build facts.
"""

from datetime import datetime, timezone
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class FactType(str, Enum):
    """Types of facts that can be verified in the build process."""
    BUILD_SUCCESS = "build_success"
    BUILD_FAILURE = "build_failure"
    TEST_PASS = "test_pass"
    TEST_FAIL = "test_fail"
    COVERAGE_CHANGE = "coverage_change"
    PERFORMANCE_REGRESSION = "performance_regression"
    SECURITY_VULNERABILITY = "security_vulnerability"
    DEPENDENCY_UPDATE = "dependency_update"
    CODE_SMELL = "code_smell"
    REFACTOR_OPPORTUNITY = "refactor_opportunity"
    FEATURE_ADDED = "feature_added"
    BUG_FIXED = "bug_fixed"
    PERFORMANCE_IMPROVED = "performance_improved"
    REFACTOR_COMPLETED = "refactor_completed"
    BREAKING_CHANGE = "breaking_change"
    DOCS_UPDATED = "docs_updated"


class VerificationStatus(str, Enum):
    """Status of fact verification against ground truth."""
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    PARTIAL = "partial"
    ERROR = "error"


class VerifiedBuildFact(BaseModel):
    """Schema for a verified build fact ready for publishing.
    
    This model represents a fact that has been extracted from build artifacts,
    verified against trusted sources, and is ready for distribution to
    configured platforms.
    
    Attributes:
        id: Unique identifier for this fact
        source_event_id: Original webhook or CI event identifier
        created_at: Timestamp when this fact was created
        fact_type: Categorical type of the fact
        summary: Human-readable short summary (max 280 chars)
        detail: Detailed markdown-formatted description
        source_repo: Repository URL or identifier
        source_commit: Git commit hash
        source_pr_id: Optional pull request or merge request ID
        source_snippet: Optional code snippet or log excerpt
        verification_status: Current verification state
        confidence_score: Confidence level (0.0 to 1.0)
        approved: Whether fact has been approved for publishing
        approved_by: User or system that approved this fact
        approved_at: Timestamp of approval
        deployed_to: List of platforms this fact was published to
    """
    
    id: str = Field(..., description="Unique identifier for this fact")
    source_event_id: str = Field(..., description="Original webhook or CI event identifier")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), 
        description="Timestamp when this fact was created"
    )
    
    fact_type: FactType = Field(..., description="Categorical type of the fact")
    summary: str = Field(..., max_length=280, description="Human-readable short summary")
    detail: str = Field(..., description="Detailed markdown-formatted description")
    
    source_repo: str = Field(..., description="Repository URL or identifier")
    source_commit: str = Field(..., description="Git commit hash")
    source_pr_id: Optional[str] = Field(None, description="Optional pull request or merge request ID")
    source_snippet: Optional[str] = Field(None, description="Optional code snippet or log excerpt")
    
    verification_status: VerificationStatus = Field(
        default=VerificationStatus.PENDING, 
        description="Current verification state"
    )
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence level from 0.0 to 1.0")
    
    approved: bool = Field(default=False, description="Whether fact has been approved for publishing")
    approved_by: Optional[str] = Field(None, description="User or system that approved this fact")
    approved_at: Optional[datetime] = Field(None, description="Timestamp of approval")
    
    deployed_to: List[str] = Field(default_factory=list, description="List of platforms this fact was published to")
    
    model_config = ConfigDict(
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "id": "fact_123abc",
                "source_event_id": "gh_456def",
                "created_at": "2024-01-15T10:30:00Z",
                "fact_type": "build_success",
                "summary": "Build #1234 completed successfully",
                "detail": "All 245 tests passed. Coverage increased by 2.3%.",
                "source_repo": "https://github.com/org/repo",
                "source_commit": "a1b2c3d4e5f67890",
                "source_pr_id": "PR-42",
                "source_snippet": None,
                "verification_status": "verified",
                "confidence_score": 0.95,
                "approved": True,
                "approved_by": "admin@example.com",
                "approved_at": "2024-01-15T10:35:00Z",
                "deployed_to": ["bluesky", "telegram"]
            }
        }
    )