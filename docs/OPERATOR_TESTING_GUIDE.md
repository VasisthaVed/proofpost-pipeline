# ProofPost V1 — Operator Testing Guide

# Purpose

This document explains:

* how the ProofPost runtime works
* how to manually test the system
* how to validate every subsystem
* how to know whether V1 is functioning correctly

This is NOT:
a coding document.

This is:
an operational walkthrough.

---

# PART 1 — Mental Model

ProofPost is:

```text id="pjlwm"
GitHub Event
→ AI Extraction
→ Verification
→ Approval Queue
→ Dispatcher
→ Platform Publishing
```

The system is NOT:
one giant app.

It is:
multiple small systems working together.

---

# Core Runtime Components

## 1. FastAPI Runtime

File:

```text id="5jlwm"
core/main.py
```

Purpose:

* starts backend server
* exposes APIs
* manages lifecycle
* connects all systems together

When running:

```bash id="gjlwm"
python main.py
```

You are starting:
the ProofPost backend runtime.

---

# 2. Swagger Docs

URL:

```text id="hjlwm"
http://127.0.0.1:7821/docs
```

Purpose:

* manual API testing
* backend inspection
* route validation

Swagger is:
NOT the app UI.

Swagger is:
the operator testing console.

---

# 3. Frontend Dashboard

URL:

```text id="4jlwm"
http://127.0.0.1:7821
```

Purpose:
future operator UI.

Current status:
minimal shell only.

Backend is the primary system right now.

---

# 4. Database

File:

```text id="3jlwm"
proofpost.db
```

Purpose:
stores:

* facts
* queue state
* deployment history
* retries
* approvals

SQLite is:
the authoritative system state.

NOT RAM.

---

# 5. EventBus

Purpose:
temporary in-memory transport system.

Used for:
moving approved jobs to dispatcher.

The EventBus is NOT authoritative.

SQLite is authoritative.

---

# 6. Dispatcher

Purpose:
takes approved jobs
and sends them to platform adapters.

Lifecycle:

```text id="9jlwm"
APPROVED
→ IN_PROGRESS
→ DISPATCHED
```

---

# 7. Platform Adapters

Purpose:
simulate or perform posting.

Examples:

* LinkedIn
* Reddit
* Bluesky

Current state:
mostly mocked/simulated.

---

# PART 2 — Starting The System

# Step 1

Open terminal:

Run:

```bash id="2jlwm"
python main.py
```

Expected logs:

```text id="8jlwm"
database.connected
event_bus.initialized
dispatcher.started
app.startup_complete
```

If these appear:
the backend is running correctly.

---

# PART 3 — Testing The Backend

# Step 2 — Open Swagger

Go to:

```text id="xjlwm"
http://127.0.0.1:7821/docs
```

This is the MOST IMPORTANT page right now.

---

# Step 3 — Test Health Endpoint

Find:

```text id="kjlwm"
GET /health
```

Click:

* Try it out
* Execute

Expected result:

```json id="1jlwm"
{
  "status": "ok",
  "db": true,
  "ai": true
}
```

This means:

* backend alive
* database connected
* AI layer initialized

---

# Step 4 — Test Pending Queue

Find:

```text id="zjlwm"
GET /api/facts/pending
```

Expected initially:

```json id="qjlwm"
{
  "items": [],
  "total": 0
}
```

Meaning:
no facts waiting for approval yet.

This is normal.

---

# PART 4 — Triggering The Pipeline

# IMPORTANT

The webhook endpoint is protected by:
HMAC verification.

Meaning:
random requests are rejected.

This is GOOD.

---

# Step 5 — Development Mode

For local testing:
DEV_MODE should bypass signature verification.

Without this:
Swagger testing is blocked.

Expected future config:

```text id="rjlwm"
DEV_MODE=true
```

---

# Step 6 — Trigger Webhook

Find:

```text id="6jlwm"
POST /webhook/github
```

Click:

* Try it out

Paste:

```json id="7jlwm"
{
  "repository": {
    "full_name": "corvo/proofpost"
  },
  "pull_request": {
    "title": "Fix dispatcher recovery bug",
    "body": "Added startup reconciliation"
  },
  "commits": [
    {
      "message": "Implemented approved recovery"
    }
  ]
}
```

Execute.

---

# Expected Runtime Flow

Terminal should show logs similar to:

```text id="mjlwm"
payload.sanitized
extraction.completed
verification.completed
fact.persisted
queue.updated
```

Meaning:
the pipeline executed successfully.

---

# PART 5 — Reviewing Generated Facts

# Step 7 — Check Queue Again

Run again:

```text id="njlwm"
GET /api/facts/pending
```

Expected:
facts now appear.

Example:

```json id="ojlwm"
{
  "items": [
    {
      "summary": "Implemented dispatcher recovery",
      "status": "pending"
    }
  ]
}
```

Meaning:
AI extraction worked.

---

# PART 6 — Approval Flow

# Step 8 — Approve A Fact

Use:

```text id="p6jlwm"
POST /api/facts/{fact_id}/approve
```

Expected result:
fact status changes.

Dispatcher receives:
approved event.

---

# Expected Logs

```text id="tjlwm"
dispatch.started
dispatch.completed
```

OR:
dry-run simulation logs.

---

# PART 7 — Deployment History

# Step 9 — Check History

Run:

```text id="5jlwmt"
GET /api/history
```

Expected:
dispatched items appear.

Meaning:
end-to-end runtime works.

---

# PART 8 — Failure Testing

# Step 10 — Recovery Validation

Purpose:
validate persistence guarantees.

Procedure:

1. Approve a fact
2. Stop backend immediately
3. Restart backend

Expected:
approved fact recovers automatically.

If successful:
recovery architecture works correctly.

---

# PART 9 — Duplicate Protection

# Step 11 — Replay Same Webhook

Submit identical webhook twice.

Expected:
second request ignored.

Meaning:
idempotency protection works.

---

# PART 10 — What "Working" Actually Means

ProofPost V1 is considered operational when:

* backend boots reliably
* health endpoint responds
* webhook ingestion works
* extraction works
* verification works
* facts persist
* approval flow works
* dispatcher runs
* retries work
* recovery works
* duplicate protection works

The frontend UI is:
secondary.

Backend operational trust is:
the real V1 milestone.

---

# PART 11 — Important Mental Model

The system is:

```text id="4jlwmy"
Operator-Controlled AI Infrastructure
```

NOT:
an autonomous AI agent.

The human operator remains:
authoritative.

AI assists:

* extraction
* summarization
* formatting

Verification and approval remain:
controlled.

---

# PART 12 — Current V1 Status

Current architecture maturity:

Backend:
strong

Persistence:
strong

Recovery:
strong

Observability:
strong

Frontend:
minimal

Current focus:
runtime correctness
before visual polish.
