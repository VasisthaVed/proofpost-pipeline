---
trigger: always_on
---

ProofPost — Agent Rules
Location: .agents/rules/autopost-rules.md
These rules are ALWAYS ON. Agent must follow them for every task.
Updated: V1.1 — frontend rules added
IDENTITY
You are building ProofPost — a deterministic, human-in-the-loop publishing pipeline.
This is NOT an autonomous agent. It is a compiler with a strict pipeline.
Every decision must be traceable, verifiable, and reversible.
BACKEND ARCHITECTURE RULES (NEVER BREAK)

Every function returns a Pydantic model — never a raw string or dict
No LLM call happens without try/except that returns a structured error
All API keys come from core/config.py reading settings.json — never hardcoded
Every database write uses parameterized queries — no string formatting ever
The dispatch queue is SQLite-backed — never asyncio.Queue alone
VerifiedBuildFact is defined ONLY in core/models.py — never redefined elsewhere
Platform adapters have exactly 3 methods: authenticate(), generate_payload(), dispatch()
Every module does ONE thing — single responsibility strictly enforced
Every new function gets a pytest test in /tests/ — no untested code
structlog is used for ALL logging — no print() statements anywhere

FRONTEND ARCHITECTURE RULES (NEVER BREAK)

No direct DOM mutations outside view files (views/*.js only)
No fetch() calls outside api.js
No store mutations outside actions object
No hardcoded colors — CSS variables from tokens.css only
No hardcoded URLs — use window.location.origin or config constants
No inline styles anywhere
No business logic inside Web Components — components dispatch events only
No JavaScript frameworks — vanilla ES Modules only
No external CDN dependencies — fully offline capable
All API data rendered via textContent or escapeHtml() — never raw innerHTML

21. Views may only render from store state — never directly from API responses

CODE STYLE RULES
Backend:

Python only — no JavaScript in backend files
PEP 8 style guide always
Type hints on every function signature
Docstring on every class and every function
No function longer than 40 lines — split if it gets longer

Frontend:

ES Modules only — no CommonJS require()
JSDoc comments on every function
CSS classes only — no inline styles
BEM-lite naming: block__element--modifier
No function longer than 30 lines — split if longer

WHAT YOU MUST NEVER DO
Backend:

Never modify core/models.py without being explicitly told to
Never add new dependencies not already in requirements.txt
Never silently swallow exceptions — always log them with structlog
Never write to the database outside of core/database.py functions
Never access settings.json directly — always go through core/config.py
Never add features that were not asked for
Never rename existing functions or classes

Frontend:

Never mutate store directly — always use actions
Never call fetch() outside api.js
Never add a new Web Component without explicit justification
Never hardcode a route string — use ROUTES constants from router.js
Never store credentials in localStorage or sessionStorage
Never use eval(), Function(), or document.write()

FOR FRONTEND WORK — MANDATORY ADDITIONAL READS
Before any frontend session also read:

docs/v1.1/UI_ENGINEERING_RULES.md
docs/v1.1/UI_SPEC.md
docs/v1.1/PLATFORM_RENDERING_SPEC.md (if working on workspace or platforms)

RESPONSE FORMAT
After writing any code output:

What you built (one sentence)
Files created or modified
Tests added (backend) or manual verification steps (frontend)
Any assumptions made
Anything the developer must manually verify
Constitution violations: NONE or list
Definition of done: PASS or what is missing