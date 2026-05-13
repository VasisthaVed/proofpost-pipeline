# ProofPost — Constitution
# docs/governance/constitution.md
# READ THIS FIRST. Every session. No exceptions.

## WHAT THIS SYSTEM IS

ProofPost is a deterministic publishing pipeline.
Not an agent. Not a chatbot. A compiler.

Input → Sanitize → Extract → Verify → Approve → Deploy

Every step is traceable. Every output maps to a source. Nothing publishes without human approval.

## WHAT THIS SYSTEM IS NOT

- Not autonomous
- Not self-publishing
- Not allowed to bypass verification
- Not allowed to skip human approval

## THE SINGLE SOURCE OF TRUTH

core/models.py contains VerifiedBuildFact.
This schema is the contract between every module.
If you need to change it: stop, flag it, get explicit approval first.
Never change it silently.

## THE PIPELINE CONTRACT

```
WebhookPayload
  → [ingestion] sanitized, hashed, verified
  → [extraction] structured VerifiedBuildFact list
  → [verification] facts checked against source
  → [approval] human approves or rejects
  → [execution] async dispatch to platforms
  → [logging] every step in structlog JSON
```

Nothing skips a stage. Nothing bypasses the contract.

## NON-NEGOTIABLE RULES

1. Pydantic models everywhere — no raw dicts or strings crossing boundaries
2. Parameterized SQL only — no string formatting in queries
3. All credentials from core/config.py — never hardcoded
4. structlog for all logging — no print()
5. SQLite-backed queue — no asyncio.Queue alone
6. Single responsibility per file — one job, one file
7. Tests required for every function
8. platform adapters: authenticate(), generate_payload(), dispatch() only
9. core/models.py: never modified without explicit instruction
10. No new dependencies without explicit approval
