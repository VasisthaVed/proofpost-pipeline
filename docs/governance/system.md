# ProofPost — System Architecture
# docs/governance/system.md

## PIPELINE FLOW

```
GitHub Webhook
      │
      ▼
[ingestion/hmac_verifier.py]     ← HMAC + timestamp validation
[ingestion/size_limiter.py]      ← payload size enforcement  
[ingestion/deduplicator.py]      ← SHA-256 idempotency
[ingestion/payload_sanitizer.py] ← XSS, injection filtering
      │
      ▼
[extraction/extractor.py]        ← LLM → VerifiedBuildFact list
      │
      ▼
[verification/verifier.py]       ← string-match against source
      │
      ▼
[Human Approval UI]              ← approve or reject
      │
      ▼
[execution/dispatcher.py]        ← SQLite queue → platforms
[execution/retry.py]             ← exponential backoff + jitter
[execution/dlq.py]               ← failed posts stored, not lost
      │
      ▼
[platforms/bluesky.py]
[platforms/reddit.py]
[platforms/telegram.py] ...
```

## MODULE RESPONSIBILITIES

| Module | Job | Touches DB? |
|---|---|---|
| ingestion/* | Validate and clean external input | deduplicator only |
| extraction/extractor.py | Raw payload → VerifiedBuildFact | No |
| verification/verifier.py | Fact vs source comparison | No |
| execution/dispatcher.py | Queue management + dispatch | Yes |
| platforms/* | Platform API calls | No |
| core/config.py | Load settings.json | No |
| core/database.py | All DB operations | Yes — only place |
| core/models.py | Pydantic schemas | No — read only |
| main.py | FastAPI routes + startup | Via core/database.py |

## DEPENDENCY RULES

```
platforms/* → must NOT import from execution/*
execution/* → must NOT import from ingestion/*
ingestion/* → must NOT import from extraction/*
extraction/* → must NOT import from verification/*
verification/* → must NOT import from execution/*

All modules → CAN import from core/*
Nobody → imports from main.py
```

Dependency flows ONE direction through the pipeline.
Circular imports = architecture violation.

## DATA SCHEMA (CANONICAL)

VerifiedBuildFact lives in core/models.py.
Every module that creates, reads, or modifies a fact uses this type.
No module defines its own version.

## QUEUE DESIGN

dispatch_queue table in SQLite:
- status: 'pending' | 'dispatched' | 'failed'
- On process startup: all 'pending' items re-enqueued
- Crash between dispatch and mark: item stays 'pending', retried on restart
- Max retries exceeded: moved to DLQ table

## CURRENT STATE

V1 in progress.
Modules completed: [update this after each session]
Tests passing: [update this after each session]
