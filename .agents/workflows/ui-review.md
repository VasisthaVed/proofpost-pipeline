---
description: 
---

# Workflow: ui-review
# Trigger: /ui-review
# Run after every major frontend phase

---

# MANDATORY CONTEXT LOAD

Read these files:
-C:\Pro\PROJECT\ProofPost\docs\governance\ai_rules.md
- docs/governance/constitution.md
- docs/v1.1/UI_ENGINEERING_RULES.md
- docs/v1.1/UI_SPEC.md
- docs/v1.1/UI_STATE_SCHEMA.md
-C:\Pro\PROJECT\ProofPost\docs\v1.1 all the v1.1 docs 


Confirm with:
"Constitution read. UI rules read. UI state read. Ready."

---

# SCOPE

ALLOWED:
- Read any frontend file
- Output findings only
- add prompt to /fix-bug with all the docs that are imp to read by ai before triggering In the report file at the very very bottom

FORBIDDEN:
- Modifying files
- Adding code
- Silent fixes

This workflow produces:
review findings only.

---

# REVIEW CHECKS

---

# 1. STATE DISCIPLINE

Check:
- Any direct store mutations?
- Any hidden state outside store?
- Any API responses rendered directly?

Violation examples:
```javascript
store.pendingFacts = facts
```

```javascript
fetch(...).then(data => {
  container.innerHTML = data
})
```

---

# 2. API DISCIPLINE

Check:

* Any fetch() calls outside api.js?
* Any hardcoded URLs?
* Any duplicated endpoint definitions?

---

# 3. COMPONENT DISCIPLINE

Check:

* Components fetching data?
* Components mutating state?
* Components containing business logic?

Components must:
render + emit only.

---

# 4. VIEW LIFECYCLE

Check:

* onActivate implemented?
* onDeactivate cleanup implemented?
* polling intervals cleared?

Flag:

* memory leaks
* duplicate listeners
* stale subscriptions

---

# 5. SECURITY REVIEW

Check:

* innerHTML usage
* unsanitized rendering
* credential exposure
* localStorage misuse
* CSP violations

---

# 6. DESIGN SYSTEM REVIEW

Check:

* hardcoded colors
* inline styles
* token violations
* inconsistent spacing
* typography drift

---

# 7. ACCESSIBILITY REVIEW

Check:

* keyboard navigation
* focus management
* ARIA labels
* contrast issues

---

# 8. ROUTE GUARDS

Check:

* onboarding protection
* invalid route handling
* setup flow enforcement

---

# OUTPUT FORMAT

```text
UI REVIEW REPORT
================

Date:
Phase:
Files reviewed:

State violations:
API violations:
Component violations:
Lifecycle violations:
Security concerns:
Accessibility concerns:
Design system violations:

Recommended actions:
OK to proceed: YES or NO
```

finally find what is missing make a report in the main   file named missing things ( if our ui is okay or shifted )  final review needs to have all  the errors gone 
