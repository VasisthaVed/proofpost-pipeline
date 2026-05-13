# ProofPost — AI Operating Rules
# docs/governance/ai_rules.md

## BEFORE EVERY TASK

Read these three files before writing a single line:
1. docs/governance/constitution.md
2. docs/architecture/system.md
3. docs/governance/ai_rules.md (this file)

Confirm you have read them by stating:
"Constitution read. Architecture read. Rules read. Ready."

If you cannot find these files, stop and ask.
Do not proceed without them.

## SCOPE CONSTRAINTS

Every task specifies:
- ALLOWED files (only these may be created or modified)
- FORBIDDEN actions (explicit list per task)

If a task does not specify scope: ask before doing anything.
If you think you need to modify a file outside the allowed list: ask first.
"I think X also needs to change" is a question, not permission to act.

## WHAT YOU MAY NEVER DO WITHOUT EXPLICIT INSTRUCTION

- Modify core/models.py
- Add entries to requirements.txt
- Rename existing functions, classes, or files
- Change function signatures
- Modify existing tests (tests define correct behavior)
- Add new API endpoints beyond what was specified
- Add new database tables beyond what was specified
- Refactor code while fixing a bug
- "Improve" code that was not mentioned in the task

## WHAT YOU MUST ALWAYS DO

- Type hints on every function
- Docstring on every class and function
- structlog for every log line
- Explicit exception handling — no bare except
- Return structured Pydantic responses — no raw dicts
- Parameterized SQL — no string formatting
- Mock external calls in tests — no real HTTP in tests
- One job per file

## DEFINITION OF DONE

A task is NOT done until:
- [ ] All specified files created or modified
- [ ] pytest tests written for every new function
- [ ] `pytest tests/` passes with 0 failures
- [ ] mypy passes (no type errors)
- [ ] No print() statements (grep confirms)
- [ ] No hardcoded credentials (grep confirms)
- [ ] structlog used for all logging
- [ ] Async functions are safe (no shared mutable state)
- [ ] Session summary output (see format below)

"Looks correct" is not done. Tests passing is done.

## SESSION SUMMARY FORMAT

At end of every task, output:

```
SESSION SUMMARY
===============
Files created:   [list]
Files modified:  [list]
Tests added:     [list with function names]
Assumptions:     [anything you assumed that wasn't specified]
Verify manually: [anything that needs human eyes]
Constitution violations: [NONE or list with explanation]
Definition of done: [PASS or list of what's missing]
```

## DRIFT PREVENTION

If the developer says "STOP" — stop immediately.
Do not finish the current function.
Do not clean up.
Just stop and wait.

If the developer says "RESET CONTEXT" — re-read all three governance docs
before the next action.
