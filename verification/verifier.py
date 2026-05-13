"""Fact verification engine.

This module provides deterministic verification of extracted facts by
cross-referencing their source snippets against the original payload.
The verifier is the final authority on fact validity.
"""

import structlog
from typing import Any, Dict, List, Optional, Union
from core.models import VerifiedBuildFact, VerificationStatus

logger = structlog.get_logger()

def _flatten_payload(payload: Any) -> str:
    """Recursively flattens a dictionary or list into a single searchable string.
    
    Args:
        payload: The data structure to flatten.
        
    Returns:
        A single string containing all values from the structure.
    """
    if isinstance(payload, dict):
        return " ".join(_flatten_payload(v) for v in payload.values())
    elif isinstance(payload, list):
        return " ".join(_flatten_payload(i) for i in payload)
    else:
        return str(payload)

def verify_fact(
    fact: VerifiedBuildFact, 
    source_payload: Dict[str, Any],
    trace_id: Optional[str] = None
) -> VerifiedBuildFact:
    """Deterministic verification of a fact against the source payload.
    
    A fact is VERIFIED if its source_snippet exists as a case-insensitive
    substring within the flattened source payload. Otherwise, it is REJECTED.
    
    Args:
        fact: The extracted fact to verify.
        source_payload: The original raw payload from the source.
        trace_id: Optional identifier for request tracing.
        
    Returns:
        The updated VerifiedBuildFact with status and confidence_score.
    """
    log = logger.bind(fact_id=fact.id)
    if trace_id:
        log = log.bind(trace_id=trace_id)
    
    if not fact.source_snippet:
        fact.verification_status = VerificationStatus.REJECTED
        fact.confidence_score = 0.0
        log.warning("verifier.rejected_no_snippet", confidence=0.0)
        return fact

    flattened_text = _flatten_payload(source_payload).lower()
    snippet_to_find = fact.source_snippet.lower()
    
    if snippet_to_find in flattened_text:
        fact.verification_status = VerificationStatus.VERIFIED
        fact.confidence_score = 1.0
        log.info("verifier.verified", confidence=1.0)
    else:
        fact.verification_status = VerificationStatus.REJECTED
        fact.confidence_score = 0.0
        log.warning("verifier.rejected_no_match", confidence=0.0)
        
    return fact

def filter_verified(
    facts: List[VerifiedBuildFact],
    trace_id: Optional[str] = None
) -> List[VerifiedBuildFact]:
    """Filters a list of facts, returning only those that are VERIFIED.
    
    Args:
        facts: List of VerifiedBuildFact instances to filter.
        trace_id: Optional identifier for request tracing.
        
    Returns:
        A list of facts where verification_status == VERIFIED.
    """
    log = logger
    if trace_id:
        log = log.bind(trace_id=trace_id)

    verified_facts = [f for f in facts if f.verification_status == VerificationStatus.VERIFIED]
    rejected_count = len(facts) - len(verified_facts)
    
    log.info(
        "verifier.filter_complete", 
        passed=len(verified_facts), 
        rejected=rejected_count
    )
    
    if len(facts) > 0 and len(verified_facts) == 0:
        log.warning("verifier.all_facts_rejected", total_input=len(facts))
        
    return verified_facts