# ProofPost V1 Completion Plan

# Objective

Finish ProofPost as:
a stable, usable, single-user local-first product.

V1 goal is NOT:
feature completeness.

V1 goal IS:
trustworthy operational workflow.

---

# V1 Definition Of Done

A user must be able to:

1. Launch ProofPost locally
2. Connect GitHub webhook
3. Add Gemini API key
4. Configure one platform adapter
5. Trigger webhook ingestion
6. See extracted facts
7. Review generated content
8. Approve or reject post
9. Dispatch successfully
10. View deployment history

---

# Current Architecture Status

## COMPLETE

* FastAPI runtime
* SQLite WAL persistence
* Recovery logic
* Verification engine
* Dispatcher
* EventBus
* Platform abstraction
* DRY_RUN mode
* DEV_MODE
* ngrok integration
* HMAC verification
* Health telemetry
* Structured logging
* Gemini provider (google-genai migration)

## IN PROGRESS

* UI synchronization (Dashboard and Settings done)
* Review workspace (Pending view enhancement)
* Generated post preview

---

# Remaining V1 Tasks

## Phase 1 — Runtime Completion

### Task 1 [DONE]
Finish Gemini migration using: google-genai package.

### Task 2 [DONE]
Verify: real extraction flow works (verified with tests/test_gemini_provider.py).

### Task 3
Disable DRY_RUN temporarily and validate: one real Bluesky post.

---

## Phase 2 — UI Stabilization

### Task 4

Fix settings hydration completely.

Required fields:

* Gemini API key
* provider selection
* Bluesky handle
* Bluesky app password
* LinkedIn token

### Task 5

Fix all frontend/backend schema mismatches.

Audit:

* /api/settings
* /api/history
* /api/facts/pending
* /api/platforms

---

## Phase 3 — Review Workspace

### Task 6

Transform Pending page into:
Review Workspace.

Required sections:

* source context
* extracted facts
* generated post preview
* confidence score
* approve/reject controls

---

## Phase 4 — Documentation

### Task 7

Write production README.

README must explain:

* what ProofPost is
* why it exists
* architecture overview
* installation
* setup
* GitHub webhook configuration
* DRY_RUN
* approval flow
* troubleshooting

---

# Explicit V1 Non-Goals

Do NOT build:

* MCP
* advanced animations
* team accounts
* cloud deployment
* enterprise auth
* React migration
* onboarding wizard
* advanced traceability graph
* analytics

These belong to:
V1.1 and V2.

---

# V1 Philosophy

ProofPost is:

Deterministic Publishing Infrastructure.

Human operator remains authoritative.

AI assists:

* extraction
* summarization
* formatting

AI does NOT autonomously publish.

---

# V1 Exit Criteria

V1 is complete ONLY when:

* first real post succeeds
* recovery tested
* duplicate prevention tested
* approval flow validated
* settings persist correctly
* review workspace operational
* README complete
* architecture review passes

# Canonical Documentation

The following files are authoritative:

Architecture:
- docs/architecture/system.md

Governance:
- docs/governance/constitution.md
- docs/governance/system.md

UI:
- docs/ui/UI_ARCHITECTURE.md
- docs/ui/UI_CONSTITUTION.md

API:
- docs/API_CONTRACTS.md

Operational Testing:
- docs/OPERATOR_TESTING_GUIDE.md

Roadmap:
- docs/ROADMAP.md