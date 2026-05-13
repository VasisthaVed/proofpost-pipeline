# ProofPost UI Stabilization Prompt

/fix-bug

Read first:

* docs/V1_COMPLETION_PLAN.md
* docs/OPERATOR_TESTING_GUIDE.md
- docs/governance/constitution.md
- docs/governance/system.md
- docs/ui/UI_ARCHITECTURE.md
- docs/API_CONTRACTS.md

Purpose:
Complete the V1 operational review workflow.

This task is:
UI stabilization and workflow completion.

NOT:
UI redesign.

---

# Current Problems

1. Settings fields partially empty despite backend values existing.
2. Gemini provider fields missing from settings UI.
3. Pending page lacks:

   * source context
   * generated post preview
   * editable review workflow
4. Review workflow currently feels like raw operator telemetry instead of a usable product flow.
5. IMPORTANT: Frontend must obey backend API contracts exactly.
            Do NOT invent response fields.
Use API_CONTRACTS.md as canonical truth.

---

# Allowed Files

* ui/index.html
* ui/static/*
* core/main.py (ONLY if response schema updates are required)

FORBIDDEN:

* dispatcher rewrites
* extraction rewrites
* database rewrites
* architecture changes

---

# Required UI Improvements

## SETTINGS PAGE

Must display:

* Gemini API key
* AI provider selection
* Bluesky handle
* Bluesky app password
* LinkedIn token

Requirements:

* defensive field access
* masked secrets
* proper save confirmation
* settings reload after save

---

## PENDING PAGE → REVIEW WORKSPACE

Transform Pending page into:
operator review workspace.

Each pending fact should show:

### Source Context

* repository
* PR title
* commit summary

### Extracted Fact

* verified fact summary
* confidence score
* verifier result

### Generated Post Preview

* platform preview
* editable textarea
* final preview before approval

### Actions

* approve
* reject
* edit locally

---

# UX Requirements

V1 aesthetic:
clean operational dashboard.

NOT:
marketing website.

Focus:
clarity and trust.

---

# Required Validation

After completion:

1. Settings persist correctly.
2. Pending page renders real extracted facts.
3. Editing preview updates local state.
4. Approve/reject updates UI immediately.
5. No undefined UI values remain.
6. Browser console clean.

---

# Required Output

Provide:

* files modified
* UI sections added
* schema mismatches fixed
* remaining V1 UI gaps
* manual validation steps

Do NOT:
suggest redesigns or V2 features.
