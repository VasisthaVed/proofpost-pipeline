---
description: 
---

# Workflow: fix-bug
# Trigger: /fix-bug
# Use this when a pytest test is failing

MANDATORY CONTEXT LOAD:
Read docs/governance/constitution.md before fixing.
Confirm with "Constitution read. Ready."

## Steps

1. Read the failing test — this defines correct behavior, do NOT change it
2. Read the function being tested
3. Identify the exact line causing the failure
4. State what is wrong in one sentence
5. Fix ONLY the broken function — touch nothing else
6. Confirm the fix does not change the function signature or return type
7. Confirm no other tests would break from this change
8. Output: what was wrong, what was changed, line number

## RULES
- Never modify the test to make it pass
- Never change the function signature
- Never add new imports unless absolutely required
- Fix the minimum possible — do not refactor while fixing
