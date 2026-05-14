# Workflow: full-system-review
# Trigger: /full-system-review
# .agents/workflows/full-system-review.md

Read ALL canonical documents before making ANY suggestion.

Mandatory read order:

1. docs/V1_COMPLETION_PLAN.md
2. docs/ROADMAP.md
3. docs/KNOWN_ISSUES.md

Architecture:
4. docs/governance/system.md
5. docs/API_CONTRACTS.md

Governance:
6. docs/governance/constitution.md
7. docs/governance/system.md
8. docs/governance/ai_rules.md

UI:
9. docs/ui/UI_ARCHITECTURE.md
10. docs/ui/UI_CONSTITUTION.md
11. docs/ui/UI_RUNTIME_FLOW.md
12. docs/ui/UI_COMPONENT_SYSTEM.md
13. docs/ui/UI_SECURITY_MODEL.md

Operations:
14. docs/OPERATOR_TESTING_GUIDE.md
15. docs/OPERATOR_DEBUG_MODE.md

Workflow files:
16. .agents/rules/autopost-rules.md
17. .agents/workflows/build-module.md
18. .agents/workflows/fix-bug.md
19. .agents/workflows/review-session.md
20. .agents/workflows/security-review.md
21. .agents/workflows/architecture-review.md

Then:
scan the current codebase structure.

Then:
produce a COMPLETE architecture and operational review.

---

# Required Output

The review MUST explain:

## 1. Current System Identity
What ProofPost currently is.

## 2. Runtime State
What currently works operationally.

## 3. Architecture Integrity
Dependency flow, persistence guarantees, recovery guarantees.

## 4. API/UI Synchronization
Whether frontend obeys backend contracts.

## 5. Governance Integrity
Whether workflows and prompts still align with canonical docs.

## 6. Current Risks
Operational, architectural, or UX risks.

## 7. Scope Drift Detection
Identify any premature V2 complexity.

## 8. V1 Readiness
What blocks V1 completion right now.

## 9. Recommended Immediate Actions
Only highest-priority operational actions.

---

# Forbidden

Do NOT:
* redesign architecture
* introduce microservices
* suggest Kubernetes
* add React migration
* propose cloud scaling
* rewrite stable systems

Focus:
operational clarity and V1 completion only.

---

# Important Principle
ProofPost is:
Deterministic Human-In-The-Loop Publishing Infrastructure.

The human operator remains authoritative.

AI assists:
* extraction
* summarization
* formatting

AI does NOT autonomously publish.
