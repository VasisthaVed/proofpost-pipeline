import pytest
from verification.verifier import verify_fact, filter_verified
from core.models import VerifiedBuildFact, FactType, VerificationStatus

@pytest.fixture
def sample_payload():
    return {
        "build": {
            "status": "Success",
            "logs": "Compilation finished. 0 errors, 12 warnings."
        },
        "commit": "abc123def",
        "author": "dev-team"
    }

@pytest.fixture
def base_fact():
    return VerifiedBuildFact(
        id="fact_1",
        source_event_id="event_1",
        fact_type=FactType.BUILD_SUCCESS,
        summary="Build succeeded",
        detail="The build finished with 0 errors",
        source_repo="repo",
        source_commit="abc123def",
        confidence_score=0.5 # Extractor's guess
    )

def test_verify_fact_success(base_fact, sample_payload):
    """Should verify if snippet exists in payload."""
    base_fact.source_snippet = "Compilation finished"
    verified = verify_fact(base_fact, sample_payload)
    
    assert verified.verification_status == VerificationStatus.VERIFIED
    assert verified.confidence_score == 1.0

def test_verify_fact_case_insensitive(base_fact, sample_payload):
    """Should verify even if casing differs."""
    base_fact.source_snippet = "COMPILATION finished"
    verified = verify_fact(base_fact, sample_payload)
    
    assert verified.verification_status == VerificationStatus.VERIFIED
    assert verified.confidence_score == 1.0

def test_verify_fact_rejected_no_match(base_fact, sample_payload):
    """Should reject if snippet is not in payload."""
    base_fact.source_snippet = "Deployment failed"
    verified = verify_fact(base_fact, sample_payload)
    
    assert verified.verification_status == VerificationStatus.REJECTED
    assert verified.confidence_score == 0.0

def test_verify_fact_rejected_empty_snippet(base_fact, sample_payload):
    """Should reject if snippet is missing."""
    base_fact.source_snippet = None
    verified = verify_fact(base_fact, sample_payload)
    
    assert verified.verification_status == VerificationStatus.REJECTED
    assert verified.confidence_score == 0.0

def test_filter_verified_logic():
    """Should filter out everything except VERIFIED status."""
    f1 = VerifiedBuildFact(
        id="f1", source_event_id="e", fact_type=FactType.BUILD_SUCCESS, 
        summary="s", detail="d", source_repo="r", source_commit="c", confidence_score=1.0
    )
    f1.verification_status = VerificationStatus.VERIFIED
    
    f2 = VerifiedBuildFact(
        id="f2", source_event_id="e", fact_type=FactType.BUILD_SUCCESS, 
        summary="s", detail="d", source_repo="r", source_commit="c", confidence_score=0.0
    )
    f2.verification_status = VerificationStatus.REJECTED
    
    facts = [f1, f2]
    filtered = filter_verified(facts)
    
    assert len(filtered) == 1
    assert filtered[0].id == "f1"

def test_filter_verified_empty():
    """Should return empty list for empty input."""
    assert filter_verified([]) == []

def test_filter_verified_all_rejected():
    """Should return empty list if none are verified."""
    f = VerifiedBuildFact(
        id="f1", source_event_id="e", fact_type=FactType.BUILD_SUCCESS, 
        summary="s", detail="d", source_repo="r", source_commit="c", confidence_score=0.0
    )
    f.verification_status = VerificationStatus.REJECTED
    
    assert filter_verified([f]) == []
