# ProofPost README Generation Prompt

/build-module

Read first:

* docs/V1_COMPLETION_PLAN.md
- docs/architecture/system.md
- docs/governance/constitution.md
- docs/governance/system.md
- docs/V1_COMPLETION_PLAN.md
- docs/ROADMAP.md

Task:
Generate the first production-grade README for ProofPost.

Goal:
Explain the product clearly to:

* developers
* operators
* reviewers
* GitHub visitors

---

# README Requirements

The README must include:

## 1. What ProofPost Is

Explain:
ProofPost is a deterministic human-in-the-loop publishing compiler.

---

## 2. Why It Exists

Explain:
developer social publishing is noisy and unverified.

ProofPost extracts verified engineering facts directly from source changes.

---

## 3. Core Workflow

Show:

GitHub Webhook
→ Extraction
→ Verification
→ Approval
→ Dispatch

---

## 4. Feature List

Include:

* deterministic verification
* human approval
* DRY_RUN mode
* recovery system
* duplicate protection
* structured logging
* platform adapters

---

## 5. Architecture Overview

Explain:

* ingestion
* extraction
* verification
* dispatcher
* SQLite WAL persistence
* EventBus role

---

## 6. Installation

Include:

* Python version
* pip install
* running uvicorn
* settings.json setup

---

## 7. GitHub Webhook Setup

Explain:

* ngrok
* webhook URL
* DEV_MODE
* HMAC behavior

---

## 8. Running Locally

Include:

* localhost:7821
* /docs Swagger
* DRY_RUN

---

## 9. Current V1 Status

Explain:

* local-first
* single-user
* operational alpha

---

# Tone

Professional.
Infrastructure-focused.
No hype language.
README should explain:
- local-first philosophy
- deterministic verification
- operator-controlled publishing
- why human approval exists

---

# Output Requirements

Generate:

* clean markdown
* proper sections
* architecture diagram blocks
* setup examples
* troubleshooting section
* roadmap section

Avoid:
marketing fluff.
