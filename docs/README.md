# AutoPost Compiler — Project Structure
# docs/README.md

## docs/ layout

docs/
├── governance/
│   ├── constitution.md      ← What this system is and isn't. Read every session.
│   ├── ai_rules.md          ← Behavioral constraints for the agent. Read every session.
│   └── decisions/           ← Architecture Decision Records (ADRs)
│       └── 001-sqlite-queue.md
├── architecture/
│   ├── system.md            ← Pipeline flow, module responsibilities. Read every session.
│   └── models.md            ← VerifiedBuildFact field-by-field explanation
├── prompts/
│   └── platform_templates.md ← Per-platform AI rewrite prompts
├── sessions/
│   └── YYYY-MM-DD.md        ← One file per build session (what was built, what passed)
├── roadmap/
│   └── v1.md                ← V1 milestones and current progress
└── reviews/
    ├── architecture/        ← Output of /architecture-review runs
    └── security/            ← Output of /security-review runs

## .agents/ layout (Anti-Gravity config)

.agents/
├── rules/
│   └── autopost-rules.md    ← Always-on constraints (injected into every prompt)
└── workflows/
    ├── build-module.md      ← /build-module
    ├── fix-bug.md           ← /fix-bug
    ├── add-platform.md      ← /add-platform
    ├── review-session.md    ← /review-session
    ├── security-review.md   ← /security-review
    └── architecture-review.md ← /architecture-review

## Workflow trigger reference

| Command | When to use |
|---|---|
| `/build-module` | Starting any new module |
| `/fix-bug` | A pytest test fails |
| `/add-platform` | Adding a new platform adapter |
| `/review-session` | End of every session, before committing |
| `/security-review` | Before any ingestion or execution code |
| `/architecture-review` | After each phase, before merges |

## Session log format (docs/sessions/YYYY-MM-DD.md)

Keep one file per session. Update after every commit.

```
# Session: [date]
## Goal
[what you planned to build]

## Completed
[what actually got built]

## Tests
[pytest output summary]

## Committed
[git commit hash + message]

## Next session
[what to build next]
```

## Current build progress

- [ ] Phase 1: Skeleton + models
- [ ] Phase 2: Config + database
- [ ] Phase 3: Ingestion (security layer)
- [ ] Phase 4: Extraction
- [ ] Phase 5: Verification
- [ ] Phase 6: Execution layer
- [ ] Phase 7: Platform adapters
- [ ] Phase 8: FastAPI main
- [ ] Phase 9: Approval UI
