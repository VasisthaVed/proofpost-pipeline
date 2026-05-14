---
description: 
---

# Workflow: build-module
# Trigger: /build-module
# Use for BACKEND module development only
# For frontend work use: /build-view or /build-component

Frontend work must use /build-view or /build-component workflows.

## MANDATORY CONTEXT LOAD

Read these files before anything:
- docs/governance/constitution.md
- docs/architecture/system.md
- docs/governance/ai_rules.md

For frontend work: STOP — use /build-view or /build-component instead.
This workflow is for Python backend modules only.

Confirm with: "Constitution read. Architecture read. Rules read. Ready."

---

## SCOPE DECLARATION

Developer must specify:

ALLOWED modifications:
- [file1]
- [file2]

FORBIDDEN:
- Modifying core/models.py (unless explicitly instructed)
- Adding dependencies without approval
- Touching any file not listed above
- Any ui/ file (use /build-view for frontend)

If scope is not declared: ask before proceeding.

---

## EXECUTION STEPS

1. Read allowed files to understand current state
2. State the module's single responsibility in one sentence
3. State inputs and outputs (types only)
4. Check: does this module already exist? Read it before modifying.
5. Check: does this import create a circular dependency?
6. Write the module code
7. Write pytest tests in tests/test_[module_name].py
8. Verify definition of done

---

## DEFINITION OF DONE

- [ ] All allowed files created or modified
- [ ] pytest tests written for every new function
- [ ] Every function has type hints
- [ ] Every function has a docstring
- [ ] structlog used for all logging (no print)
- [ ] No hardcoded credentials
- [ ] No bare except clauses
- [ ] Pydantic models returned (no raw dicts)
- [ ] Parameterized SQL only
- [ ] Async functions have no shared mutable state
- [ ] Session summary output

---

## SESSION SUMMARY FORMAT

FILES CREATED: [list]
FILES MODIFIED: [list]
TESTS ADDED: [list]
ASSUMPTIONS: [list]
VERIFY MANUALLY: [list]
CONSTITUTION VIOLATIONS: NONE or [list]
DEFINITION OF DONE: PASS or [what is missing]