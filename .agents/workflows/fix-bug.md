---
description: # Workflow: fix-bug # Trigger: /fix-bug # Handles: runtime bugs, UI bugs, test failures, architectural fixes # Updated: V1.2 engineering discipline applied
---

# Workflow: fix-bug # Trigger: /fix-bug 

---

## MANDATORY CONTEXT LOAD

Read these before touching anything:
- docs/governance/constitution.md
- docs/v1.2/ENGINEERING_DISCIPLINE.md

Confirm with: "Constitution read. Discipline read. Ready."

---

## STEP 0 — CLASSIFY THE BUG

Before anything else, state which type this bug is:

```
TYPE A — Test Failure
  A pytest test is failing.
  Fix the implementation. Never modify the test.

TYPE B — Runtime Bug
  Tests pass but behavior is wrong at runtime.
  Example: Bluesky posts 3 times, settings don't save,
  dashboard shows stale data.

TYPE C — UI Bug
  Frontend behavior is wrong.
  Example: button does nothing, data shows undefined,
  layout breaks on mobile.

TYPE D — Architectural Bug
  Implementation violates a constitution rule.
  Example: innerHTML with API data, fetch() outside api.js,
  store mutation outside actions.

```

State the type. Then follow the correct path below.

---

## PATH A — TEST FAILURE

### Phase 1 — Understand (no edits)
Read:
- The failing test (defines correct behavior — never change it)
- The function being tested
- Any related files the function imports

Explain back:
- What the test expects
- What the function currently does
- Why they disagree (one sentence)

### Phase 2 — Plan (no edits)
State:
- The exact line that is wrong
- What the fix is
- Whether the fix changes the function signature (it must NOT)
- Whether other tests could break

### Phase 3 — Fix
ALLOWED: the specific function file only
FORBIDDEN:
- Modifying the test
- Changing the function signature
- Changing the return type
- Refactoring unrelated code
- Adding imports unless absolutely required

### Phase 4 — Validate
```
Run: pytest tests/ -v
Must be green. If other tests broke: you changed too much.
Revert and try a smaller fix.
```

### Output format
```
BUG TYPE: A — Test Failure
FILE: [file:line]
WHAT WAS WRONG: [one sentence]
WHAT CHANGED: [exact change]
TESTS NOW: [green / still failing]
OTHER TESTS AFFECTED: NONE or [list]
```

---

## PATH B — RUNTIME BUG

This is the most dangerous type.
Tests passed. Runtime is still broken.
This means the bug lives BETWEEN components, not inside one.

### Phase 1 — Understand (no edits)

Read ALL files involved in the broken flow:
```
Example for Bluesky duplicate post bug:
- platforms/bluesky.py (what dispatch() returns)
- execution/dispatcher.py (what it checks for success)
- tests/test_dispatcher.py (what the test mocked)
```

Explain back:
- The complete flow from trigger to failure
- Where the assumption breaks down
- Why the test didn't catch it (important — understand the gap)
- What the correct behavior should be

### Phase 2 — Plan (no edits)
State:
- Which file contains the root cause (usually one)
- What the minimal fix is
- What the manual verification test will be
- Why this won't break other components

### Phase 3 — Fix
ALLOWED: the root cause file + its test file only
FORBIDDEN: touching other files to "work around" the bug

### Phase 4 — Validate (ALL required)
```
Step 1: pytest → green
Step 2: uvicorn → start app, no errors
Step 3: manual trigger → exercise the broken flow end to end
Step 4: verify the specific symptom is gone
Step 5: verify no regression in adjacent behavior
```

### Output format
```
BUG TYPE: B — Runtime Bug
ROOT CAUSE FILE: [file:line]
WHY TEST MISSED IT: [one sentence — important]
WHAT WAS WRONG: [the broken assumption]
WHAT CHANGED: [exact change]
MANUAL TEST: [what you did to verify]
RESULT: [what happened]
REGRESSION CHECK: NONE or [what was checked]
```

---

## PATH C — UI BUG

### Phase 1 — Understand (no edits)

Read:
- The view file where the bug appears
- ui/api.js (if it's a data issue)
- ui/store.js (if it's a state issue)
- The backend endpoint (if data is wrong from server)

Explain back:
- Is the bug in data fetching, state management, or rendering?
- What does the network response actually contain?
- What does the UI expect?
- Where does the mismatch happen?

### Phase 2 — Plan (no edits)
State:
- Is this a frontend fix, backend fix, or both?
- Exactly which files change
- What the fix is

### Phase 3 — Fix
ALLOWED: the specific view/component file
FORBIDDEN:
- ui/store.js (unless adding a missing action only)
- ui/router.js
- ui/api.js (unless endpoint wrapper is missing)
- Any backend file (unless backend is confirmed wrong)
- Inline styles
- innerHTML with API data

### Phase 4 — Validate
```
Step 1: Open browser → reproduce the bug → confirm it's fixed
Step 2: Open DevTools → Console tab → zero JS errors
Step 3: Open DevTools → Network tab → API calls returning correct data
Step 4: Try the error case — what happens when backend is down?
Step 5: Check dark and light theme both render correctly
```

### Output format
```
BUG TYPE: C — UI Bug
ROOT CAUSE: [data / state / rendering]
FILE CHANGED: [file:line]
WHAT WAS WRONG: [one sentence]
WHAT CHANGED: [exact change]
BROWSER VERIFIED: YES
CONSOLE ERRORS: NONE or [list]
```

---

## PATH D — ARCHITECTURAL BUG

A constitution violation. Must be treated seriously.

### Phase 1 — Understand (no edits)

Read:
- docs/governance/constitution.md
- The violating file
- The files that depend on the violating file

Explain back:
- Which rule is violated (quote the exact rule)
- Where the violation is (file and line)
- What the compliant version looks like
- What could break if the violation is left in place

### Phase 2 — Plan (no edits)
State:
- The minimal fix that restores compliance
- Whether any callers need to change
- Whether tests need to change

### Phase 3 — Fix
ALLOWED: the violating file + direct callers if signature changes
FORBIDDEN: everything else

### Phase 4 — Validate
```
Step 1: grep for the violation pattern to confirm it's gone
  Example: grep -rn "innerHTML" ui/views/ → must be zero for raw data
  Example: grep -rn "fetch(" ui/views/ → must be zero
Step 2: pytest → green
Step 3: runtime check — does the feature still work?
```

### Output format
```
BUG TYPE: D — Architectural Bug
RULE VIOLATED: [quote the exact rule]
FILE: [file:line]
WHAT WAS WRONG: [the violation]
WHAT CHANGED: [compliant replacement]
GREP VERIFICATION: [command + result]
CONSTITUTION VIOLATIONS REMAINING: NONE or [list]
```

---

## UNIVERSAL RULES (all bug types)

- Never fix two bugs in one session unless they are in the same file
- Never refactor while fixing — fix is minimum change only
- Never add features while fixing a bug
- If the fix requires touching more than 3 files: stop and ask
  "This is bigger than a bug fix. Should we plan this as a feature?"
- Always explain WHY before HOW

---

## WHEN THE BUG IS UNCLEAR

If you cannot classify the bug type or identify the root cause:

Run this diagnostic first:

```
DIAGNOSTIC MODE

Read these files without making any changes:
[list the files involved in the broken flow]

Answer these questions:
1. What is the expected behavior?
2. What is the actual behavior?
3. At what point in the flow does behavior diverge?
4. What does the data look like at each step?
5. Which file is responsible for the divergence?

Output your findings. I will decide whether to proceed.
```

Never guess. Never try random fixes. Understand first.

---

## AFTER THE FIX

```bash
git add [specific files only — never git add .]
git commit -m "fix: [description] — manually verified"
```

The "manually verified" suffix confirms you ran the manual validation.
If you cannot write it honestly: you have not verified yet.