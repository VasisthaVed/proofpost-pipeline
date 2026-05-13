# Anti-Gravity Quick Reference — AutoPost Compiler
### How to use Anti-Gravity correctly for this project

---

## HOW ANTI-GRAVITY WORKS (WHAT YOU LEARNED)

Anti-Gravity has 3 layers of control:

| Layer | What it is | Always on? | How to set |
|---|---|---|---|
| **Rules** | Permanent constraints, like a system prompt | ✅ YES | `...` → Customizations → Rules → +Workspace |
| **Workflows** | Saved commands you trigger with `/name` | ❌ On demand | `...` → Customizations → Workflows → +Workspace |
| **Plan Mode** | Agent makes a plan before acting | On request | Type "plan first then build" |

---

## SETUP STEPS (DO THESE ONCE)

### Step 1 — Add the Rules file
1. Open Anti-Gravity
2. Click `...` top right → Customizations → Rules → `+ Workspace`
3. Name it: `autopost-rules`
4. Paste the entire content of `.agents/rules/autopost-rules.md`
5. Save

This is now **always on**. Every prompt Anti-Gravity receives will have these rules injected automatically.

### Step 2 — Add the 4 Workflows
Repeat for each workflow file:
1. Click `...` → Customizations → Workflows → `+ Workspace`
2. Name and paste each one:

| Command | File | Use when |
|---|---|---|
| `/build-module` | `build-module.md` | Starting any new module |
| `/fix-bug` | `fix-bug.md` | A pytest test fails |
| `/add-platform` | `add-platform.md` | Adding Reddit, Bluesky, etc. |
| `/review-session` | `review-session.md` | End of every session |

### Step 3 — Set Agent Mode
- Set to **Agent-assisted development** (recommended mode)
- Terminal Policy: **Ask me** (not Auto — you want to approve terminal commands)
- This way Anti-Gravity plans but you confirm before it runs anything

---

## HOW TO START EACH SESSION

Every session starts the same way:

```
I'm building AutoPost Compiler. Open and read these files first:
- core/models.py
- core/config.py
- requirements.txt

Then tell me what you see before we start.
```

This anchors the agent to your actual codebase, not what it imagined.

---

## THE EXACT PROMPTS FOR EACH BUILD SESSION

### Session 1 — Skeleton
```
/build-module

Build the project skeleton for AutoPost Compiler.
Create all empty files with docstrings from this structure:

autopost_compiler/
├── core/
│   ├── __init__.py
│   ├── models.py       ← VerifiedBuildFact schema (see below)
│   ├── config.py       ← reads settings.json
│   └── database.py     ← SQLite setup
├── ingestion/
│   ├── __init__.py
│   ├── hmac_verifier.py
│   ├── payload_sanitizer.py
│   ├── size_limiter.py
│   └── deduplicator.py
├── extraction/
│   ├── __init__.py
│   ├── extractor.py
│   └── mock_provider.py
├── verification/
│   ├── __init__.py
│   └── verifier.py
├── execution/
│   ├── __init__.py
│   ├── dispatcher.py
│   ├── retry.py
│   └── dlq.py
├── platforms/
│   ├── __init__.py
│   ├── base.py
│   ├── bluesky.py
│   ├── reddit.py
│   └── telegram.py
├── ui/
│   └── index.html
├── tests/
│   └── __init__.py
├── main.py
├── requirements.txt
└── .gitignore

For core/models.py, implement the VerifiedBuildFact schema exactly as I paste below.
[paste the schema from AUTOPOST_COMPILER_REVIEW.md]
```

### Session 2 — Config + Database
```
/build-module

Implement core/config.py and core/database.py.

core/config.py must:
- Load settings from config/settings.json
- Provide get_ai_config(), get_platform_credentials(platform_id), get_app_settings()
- Never crash if settings.json is missing — return safe defaults
- Never expose raw credentials in logs

core/database.py must:
- Create tables: posts, results, dispatch_queue, platform_rate_limits
- WAL mode enabled
- Functions: save_post(), save_result(), get_history(limit, offset), 
  enqueue_dispatch(post_id), dequeue_pending(), mark_dispatched(post_id)
- On startup: re-enqueue anything in dispatch_queue with status='pending'

Use the schema from core/models.py.
```

### Session 3 — Ingestion (Security Layer)
```
/build-module

Implement the 4 ingestion files. Each has ONE job:

ingestion/hmac_verifier.py
- verify_signature(payload_bytes, signature_header, secret) → bool
- Reject webhooks older than 5 minutes (replay protection)

ingestion/payload_sanitizer.py  
- sanitize(raw_payload: dict) → dict
- Strip HTML, remove script tags, neutralize markdown injection

ingestion/size_limiter.py
- check_size(payload_bytes: bytes, max_kb: int = 512) → bool

ingestion/deduplicator.py
- compute_hash(payload: dict) → str  (SHA-256)
- is_duplicate(hash: str) → bool  (checks DB)
- mark_seen(hash: str) → None

Write security-focused tests for each. Test edge cases:
- Oversized payload
- Replay attack (old timestamp)
- Invalid HMAC
- SQL injection attempt in payload
```

### Session 4 — Extraction
```
/build-module

Implement extraction/extractor.py and extraction/mock_provider.py.

extractor.py must:
- Take sanitized payload dict → return list[VerifiedBuildFact]
- Use instructor + Pydantic for schema-constrained LLM output
- Load AI provider from core/config.py
- Every LLM call has a timeout (10 seconds) and retry (max 2)

mock_provider.py must:
- Implement the same interface as the real AI provider
- Return deterministic fake VerifiedBuildFacts from fixture data
- Used in all tests so no real AI calls happen during testing

Test with mock_provider only — never call real AI in tests.
```

### Session 5 — Verification
```
/build-module

Implement verification/verifier.py.

For V1, verification is DETERMINISTIC — no LLM in this step.

verify(fact: VerifiedBuildFact, source_payload: dict) must:
- Check that fact.source_snippet exists in the source_payload text
- If yes: set verification_status = "verified", confidence_score = 1.0
- If no: set verification_status = "rejected", confidence_score = 0.0
- Return the updated VerifiedBuildFact

filter_verified(facts: list[VerifiedBuildFact]) → list[VerifiedBuildFact]:
- Return only facts with verification_status == "verified"
- Log count of rejected facts with structlog

No LLM calls in this module. String matching only.
```

### Session 6 — Execution Layer
```
/build-module

Implement execution/dispatcher.py, execution/retry.py, execution/dlq.py.

dispatcher.py must:
- On startup: load all pending items from dispatch_queue (crash recovery)
- Process dispatch queue items one at a time with delay between platforms
- Load platform adapters dynamically from platforms/
- Call platform.authenticate() then platform.dispatch()
- On success: mark_dispatched() in DB
- On failure: send to DLQ after max retries exceeded

retry.py must:
- exponential_backoff(attempt: int) → float  (seconds to wait)
- Jitter: add random 0-2 second offset to prevent thundering herd

dlq.py must:
- store_failed(post_id, platform, error) → None  (SQLite)
- get_failed_items() → list  (for manual review)
- retry_item(dlq_id) → None  (re-enqueue)

CRITICAL: dispatch_queue must survive process restart.
Use SQLite. Never asyncio.Queue alone.
```

### Session 7 — Platform Adapters
```
/add-platform

Add these 3 platform adapters:
- platforms/bluesky.py  (AT Protocol, app password auth)
- platforms/reddit.py   (PRAW, OAuth)
- platforms/telegram.py (Bot API, bot_token + chat_id)

Each must extend platforms/base.py.
Load credentials from core/config.py.
Mock all HTTP calls in tests.
```

### Session 8 — FastAPI Main + Routes
```
/build-module

Implement main.py — the FastAPI application.

Routes needed:
GET  /health                    → system status
GET  /api/platforms             → platform list + connection status  
POST /api/platforms/{id}/test   → test platform credentials
POST /api/ingest/webhook        → receive webhook (calls ingestion pipeline)
GET  /api/facts/pending         → facts awaiting human approval
POST /api/facts/{id}/approve    → human approves a fact
POST /api/facts/{id}/reject     → human rejects a fact
GET  /api/history               → post history from SQLite

On startup:
- Load settings
- Initialize database (create tables if not exist)
- Re-enqueue pending dispatch items (crash recovery)
- Start background dispatcher

Serve ui/index.html as static at GET /
```

### Session 9 — Approval UI
```
Build ui/index.html — the human approval dashboard.

It must:
- Show all pending VerifiedBuildFacts awaiting approval
- Each fact shows: type, summary, source_snippet, confidence_score
- Approve button → POST /api/facts/{id}/approve
- Reject button → POST /api/facts/{id}/reject
- History section → GET /api/history
- Health section → GET /health

Dark theme. Vanilla JS only. No frameworks.
Simple is fine — this is an internal tool, not a marketing page.
```

---

## END OF SESSION RITUAL

Always end with:
```
/review-session
```

Then:
```bash
pytest tests/ -v --tb=short
git diff
git add [only the files from this session]
git commit -m "feat: [module name] - [one line description]"
```

---

## WHEN ANTI-GRAVITY DRIFTS

If it starts doing something wrong, say:

```
STOP.
You violated Rule [paste the rule].
Undo the last change to [filename].
Rewrite only [specific function] to comply with the rule.
Do not touch anything else.
```

---

## MODEL SELECTION IN ANTI-GRAVITY

Anti-Gravity supports multiple models. Use them strategically:

| Task | Model |
|---|---|
| Building new modules | Gemini 3 Pro (default, best reasoning) |
| Fixing small bugs | Gemini 3 Flash (faster, cheaper) |
| Security-sensitive code (ingestion, verification) | Claude Sonnet 4.6 (more cautious) |
| Final review | Claude Opus 4.6 (most thorough) |

Switch model in Anti-Gravity via the model selector in the chat panel.

---

## FILE LOCATIONS (REMINDER)

```
Rules:     .agents/rules/autopost-rules.md        ← always on
Workflows: .agents/workflows/build-module.md      ← /build-module
           .agents/workflows/fix-bug.md           ← /fix-bug
           .agents/workflows/add-platform.md      ← /add-platform
           .agents/workflows/review-session.md    ← /review-session
```

These files live inside your project repo.
Commit them. They are part of the project.
