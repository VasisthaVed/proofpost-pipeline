---
description: 
---

# Workflow: architecture-review

# Trigger: /architecture-review

# Purpose: Operational architecture audit before merges, releases, and phase transitions

---

# MANDATORY CONTEXT LOAD

Read ALL canonical documents before analysis.

Required read order:

## Governance

* docs/governance/constitution.md
* docs/governance/system.md
* docs/governance/ai_rules.md

## Architecture

* docs/architecture/system.md
* docs/API_CONTRACTS.md
* docs/CANONICAL_STRUCTURE.md

## Operational State

* docs/V1_COMPLETION_PLAN.md
* docs/ROADMAP.md
* docs/KNOWN_ISSUES.md

## UI

* docs/ui/UI_ARCHITECTURE.md
* docs/ui/UI_RUNTIME_FLOW.md
* docs/ui/UI_SECURITY_MODEL.md

Confirm with:
"Constitution read. Architecture read. Rules read. Ready."

---

# SCOPE

ALLOWED:

* read any file
* analyze imports
* inspect schemas
* inspect runtime flow
* inspect frontend/backend synchronization
* inspect persistence guarantees

FORBIDDEN:

* modifying any file
* generating implementation code
* redesigning architecture during review

This workflow produces:
FINDINGS ONLY.

Fixes happen in separate sessions.

---

# ARCHITECTURE CHECKS

## 1. Dependency Direction

Map ALL imports across modules.

Expected flow:

ingestion
→ extraction
→ verification
→ execution
→ platforms

Check:

* any reverse dependency flow
* circular imports
* modules importing main.py
* platform adapters importing execution/*
* extraction importing verification/*
* frontend importing internal runtime structures

Flag ALL violations.

---

## 2. Hidden Coupling

Check:

* shared mutable globals
* implicit database communication
* modules relying on another module's internal structure
* frontend relying on undocumented API fields
* duplicated schema assumptions

Check whether:
API_CONTRACTS.md matches actual backend responses.

---

## 3. Single Responsibility Violations

For EACH file:
state its responsibility in ONE sentence.

If impossible:
flag SRP violation.

Special attention:

* core/main.py
* dispatcher.py
* ui/index.html

---

## 4. Runtime Integrity

Verify:

* persistence guarantees
* transactional boundaries
* crash recovery flow
* dispatcher recovery semantics
* pending/approved state recovery
* DRY_RUN safety behavior
* duplicate prevention guarantees

Check:
Can any verified fact be lost during crash windows?

---

## 5. Frontend / Backend Synchronization

Verify:

* frontend obeys API_CONTRACTS.md
* no invented fields
* no undefined state paths
* settings hydration correctness
* pending queue rendering correctness
* approve/reject synchronization

Flag:
schema mismatches immediately.

---

## 6. Unnecessary Complexity

Check:

* abstractions with single implementation
* dead configuration fields
* unused adapters
* unnecessary inheritance
* modules that should be functions
* speculative V2 architecture added too early

Flag:
premature complexity.

---

## 7. Future Maintenance Burden

Analyze:

* AI provider replacement difficulty
* platform adapter interchangeability
* verification engine isolation
* frontend maintainability
* API evolution risks
* settings synchronization risks

Identify:
highest long-term maintenance risks.

---

## 8. Governance Integrity

Verify:

* prompts reference correct canonical files
* workflows align with current architecture
* governance paths are correct
* no stale documentation references remain

Flag:
documentation drift.

---

## 9. Scope Drift Detection

Verify:
project remains aligned with:

"Deterministic Human-In-The-Loop Publishing Infrastructure"

Flag:

* premature SaaS complexity
* premature cloud scaling
* premature MCP complexity
* premature enterprise abstractions
* UI overengineering

V1 priority is:
operational trustworthiness.

---

## 10. V1 Operational Readiness

Determine:
Can ProofPost currently function as:

single-user local-first operational alpha?

Evaluate:

* runtime stability
* UI usability
* recovery guarantees
* dispatch safety
* operator workflow completeness

---

# OUTPUT FORMAT

# ARCHITECTURE REVIEW REPORT

Date: [date]

Phase:
[current development phase]

Files reviewed:
[list]

---

Dependency violations:
[list or NONE]

Hidden coupling:
[list or NONE]

SRP violations:
[list or NONE]

Runtime integrity risks:
[list or NONE]

Frontend/backend sync issues:
[list or NONE]

Complexity concerns:
[list or NONE]

Maintenance risks:
[list or NONE]

Governance drift:
[list or NONE]

Schema issues:
[list or NONE]

Scope drift:
[list or NONE]

---

Recommended actions:
[ordered highest priority first]

---

V1 Operational Readiness:
[READY / NOT READY]

Reason:
[detailed explanation]

---

OK to proceed to next phase:
YES or NO

Reason if NO:
[required blocking fixes]

---

Important Principle:

ProofPost is:

Deterministic Human-In-The-Loop Publishing Infrastructure.

The human operator remains authoritative.

AI assists:

* extraction
* summarization
* formatting

AI does NOT autonomously publish.
