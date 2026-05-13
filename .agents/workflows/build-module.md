# Workflow: build-module
# Trigger: /build-module
# .agents/workflows/build-module.md

## MANDATORY CONTEXT LOAD (do this before anything else)

Read these files now:
- docs/governance/constitution.md
- docs/architecture/system.md
- docs/governance/ai_rules.md

Confirm with: "Constitution read. Architecture read. Rules read. Ready."

---

## SCOPE DECLARATION

Before starting, the developer must specify:

ALLOWED modifications:
- [file1]
- [file2]

FORBIDDEN:
- Modifying core/models.py
- Adding dependencies
- Touching any file not listed above

If scope is not declared: ask before proceeding.

---

## EXECUTION STEPS

1. Read the allowed files to understand current state
2. State the module's single responsibility in one sentence
3. State its inputs and outputs (types, not descriptions)
4. Check: does this module already exist? If yes, read it before modifying
5. Check: does this module import anything that creates a circular dependency?
6. Write the module code
7. Write pytest tests in tests/test_[module_name].py
8. Verify definition of done (see below)

---

## DEFINITION OF DONE

Do not output "done" until every box is checked:

- [ ] All allowed files created or modified
- [ ] pytest tests written for every new function
- [ ] Every function has type hints
- [ ] Every function has a docstring
- [ ] structlog used for all logging (no print)
- [ ] No hardcoded credentials
- [ ] No bare except clauses
- [ ] Pydantic models returned (no raw dicts)
- [ ] Parameterized SQL only (no string formatting)
- [ ] Async functions have no shared mutable state
- [ ] Session summary output

---

## OUTPUT FORMAT

SESSION SUMMARY
===============
Files created:   [list]
Files modified:  [list]
Tests added:     [list]
Assumptions:     [anything assumed]
Verify manually: [anything needing human review]
Constitution violations: NONE or [list]
Definition of done: PASS or [what's missing]
