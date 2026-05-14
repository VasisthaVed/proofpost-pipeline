# ProofPost — Workspace State Machine
# docs/v1.1/WORKSPACE_STATE_MACHINE.md

---

# PURPOSE

Defines the authoritative lifecycle of a fact inside the ProofPost Workspace.

Goals:
- deterministic operator flow
- safe approval boundaries
- observable transitions
- predictable UI behavior

The workspace is state-driven.
All UI behavior must map to these states.

---

# CORE PRINCIPLE

A fact is never:
- auto-approved
- auto-dispatched
- silently modified

Human approval remains authoritative.

---

# PRIMARY STATE FLOW

```text
PENDING
→ SELECTED
→ REVIEWING
→ EDITING
→ READY
→ APPROVING
→ DISPATCHING
→ DISPATCHED
```

Failure branches:

```text
READY
→ REJECTED

DISPATCHING
→ FAILED
→ RETRYING
→ DISPATCHED
```

---

# STATE DEFINITIONS

---

## PENDING

Meaning:
Fact exists in queue but not selected.

Visible in:

* dashboard
* workspace list

Allowed actions:

* select
* reject

Forbidden:

* dispatch

---

## SELECTED

Meaning:
Operator selected the fact.

System loads:

* previews
* verification evidence
* platform render

Allowed:

* switch platforms
* inspect evidence

---

## REVIEWING

Meaning:
Operator actively reviewing evidence.

Purpose:
encourage validation before editing.

Allowed:

* expand evidence
* inspect source diff
* compare render versions

---

## EDITING

Meaning:
Operator modified generated draft.

Triggers:

```text
draftContent !== originalContent
```

UI requirements:

* unsaved changes indicator
* edit warning threshold

---

## READY

Meaning:
Fact is validated and ready for approval.

Conditions:

* preview rendered
* evidence loaded
* platform valid

---

## APPROVING

Meaning:
Approval request in-flight.

UI behavior:

* disable duplicate clicks
* loading spinner
* optimistic lock
* in-flight guard: early return if already dispatching

---

## DISPATCHING

Meaning:
Dispatcher accepted fact.

UI displays:

* platform progress
* retry state
* response timing

---

## DISPATCHED

Meaning:
Platform acknowledged successful publish.

UI displays:

* success state
* post URL
* timestamp

Fact moves:
workspace → history

---

## FAILED

Meaning:
Dispatch failed.

UI displays:

* error reason
* retry button
* platform status

Failure never silently disappears.

---

## RETRYING

Meaning:
Dispatcher retry cycle active.

Must display:

* retry count
* next retry timing

---

## REJECTED

Meaning:
Operator rejected fact.

Fact removed from active queue.

Audit trail preserved.

---

# STATE TRANSITION RULES

INVALID:

```text
PENDING → DISPATCHED
```

VALID:

```text
PENDING → SELECTED → READY → APPROVING → DISPATCHING
```

---

# UI SAFETY RULES

Workspace must:

* visually distinguish states
* prevent impossible actions
* prevent duplicate approvals

Example:
Approve button disabled during APPROVING.

---

# PLATFORM-SPECIFIC STATES

Future support:

```text
DISPATCHING_LINKEDIN
DISPATCHING_BLUESKY
PARTIAL_SUCCESS
```

Reserved for V2.

---

# OBSERVABILITY INTEGRATION

Every transition emits:

```text
workspace.state_transition
```

Payload:

```json
{
  "fact_id": "fact_123",
  "from": "READY",
  "to": "APPROVING",
  "timestamp": "..."
}
```

---

# EDIT SAFETY

If operator edits exceed threshold:

```text
verification_confidence = reduced
```

UI warning required.

---

# FUTURE V2 EXTENSIONS

Reserved:

* collaborative review
* multi-approver flow
* scheduled publishing
* semantic grouping
* release-level approval
