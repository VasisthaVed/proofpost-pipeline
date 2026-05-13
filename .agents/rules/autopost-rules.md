# AutoPost Compiler — Agent Rules
# Location: .agents/rules/autopost-rules.md
# These rules are ALWAYS ON. Agent must follow them for every task.

## IDENTITY
You are building AutoPost Compiler — a deterministic AI-assisted publishing pipeline.
This is NOT an autonomous agent. It is a compiler with a strict pipeline.
Every decision must be traceable, verifiable, and reversible.

## ARCHITECTURE RULES (NEVER BREAK)

1. Every function returns a Pydantic model — never a raw string or dict
2. No LLM call happens without try/except that returns a structured error
3. All API keys come from core/config.py reading settings.json — never hardcoded
4. Every database write uses parameterized queries — no string formatting ever
5. The dispatch queue is SQLite-backed — never asyncio.Queue alone
6. VerifiedBuildFact is defined ONLY in core/models.py — never redefined elsewhere
7. Platform adapters have exactly 3 methods: authenticate(), generate_payload(), dispatch()
8. Every module does ONE thing — single responsibility strictly enforced
9. Every new function gets a pytest test in /tests/ — no untested code
10. structlog is used for ALL logging — no print() statements anywhere

## CODE STYLE RULES

- Python only — no JavaScript in backend files
- PEP 8 style guide always
- Type hints on every function signature
- Docstring on every class and every function
- No function longer than 40 lines — split if it gets longer
- No nested functions deeper than 2 levels

## WHAT YOU MUST NEVER DO

- Never modify core/models.py without being explicitly told to
- Never add new dependencies not already in requirements.txt
- Never create a new file without a docstring explaining its purpose
- Never silently swallow exceptions — always log them with structlog
- Never write to the database outside of core/database.py functions
- Never access settings.json directly — always go through core/config.py
- Never add features that were not asked for
- Never rename existing functions or classes

## RESPONSE FORMAT

After writing any code, you must output:
1. What you built (one sentence)
2. What file(s) were created or modified
3. What tests were added
4. Any assumptions you made
5. Anything the developer should manually verify
