# ProofPost — Workspace Specification
# docs/v1.1/WORKSPACE_SPEC.md

---

# PURPOSE

The Workspace is the core operational surface of ProofPost.

This is where:
- verified facts are reviewed
- platform previews are rendered
- operators edit messaging
- approvals happen
- trust is visualized

The Workspace IS the product.

---

# PRIMARY GOALS

1. Make verification visible
2. Make approvals safe
3. Make editing intuitive
4. Preserve trust boundaries
5. Support beginner and pro workflows

---

# LAYOUT STRUCTURE

```text
┌───────────────────────────────────────┐
│ Topbar                               │
├──────────────┬────────────────────────┤
│ Fact List    │ Workspace Stage        │
│              │                        │
│ pending      │ preview tabs           │
│ verified     │ editor                 │
│ confidence   │ verification evidence  │
│ timestamps   │ dispatch controls      │
└──────────────┴────────────────────────┘
```

---

# FACT LIST PANEL

Displays:

* summary
* fact type
* confidence
* source repo
* timestamp

Selection updates:

```javascript
workspace.selectedFactId
```

---

# PREVIEW TABS

Platforms:

* Bluesky
* LinkedIn

Each tab:

* renders platform-specific preview
* shows character counts
* shows platform constraints

Changing tabs:
does NOT modify underlying verification evidence.

---

# VERIFICATION EVIDENCE PANEL

Always visible.

Displays:

* source snippet
* matched text
* confidence
* verification method
* commit SHA
* repository

Purpose:
show WHY the system trusts the fact.

---

# EDITOR RULES

Operators MAY:

* rewrite tone
* add context
* shorten content
* adjust hashtags

Operators MUST NOT:

* invent unsupported claims
* remove core verified fact

---

# EDIT WARNING SYSTEM

If edit distance > threshold:
show warning:

"Large edits detected. Verify the core fact remains accurate."

Operator may override.

---

# DISPATCH FLOW

```text
Select Fact
→ Select Platform
→ Review Evidence
→ Edit Draft
→ Approve
→ Dispatch
→ Success State
```

---

# WORKSPACE STATES

```text
EMPTY
LOADING
READY
EDITING
DISPATCHING
SUCCESS
ERROR
```

All states must render intentionally.

No blank screens.

---

# KEYBOARD SHORTCUTS

| Shortcut   | Action         |
| ---------- | -------------- |
+| J / K      | Navigate facts |
+| Tab        | Move focus     |
+| Ctrl+Enter | Approve        |
+| Esc        | Close modal    |
+| Cmd/Ctrl+S | Save draft     |

---

# SAFETY RULES

Workspace NEVER:

* auto approves
* auto dispatches
* hides verification evidence
* silently mutates drafts

Human remains authoritative.

---

## DRAFT PERSISTENCE

Workspace MUST:
* rehydrate draftContent from localStorage on refresh (keyed by selectedFactId)
* clear draftContent from localStorage only on successful dispatch or explicit reject

---

# OBSERVABILITY INTEGRATION

Workspace shows:

* render timing
* dispatch timing
* platform response
* retry status

---

# EMPTY STATES

No facts:

```text
"No verified facts awaiting review."
```

No platforms connected:

```text
"Connect a platform to begin dispatching."
```

---

# FUTURE V2 EXTENSIONS

Reserved:

* threaded previews
* image attachments
* semantic grouping
* release narratives
* collaborative review
