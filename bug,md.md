---
description: ProofPost V1.1 — UX Completion & Interaction Hardening
---

# Workflow: fix-bug
# Trigger: /fix-bug
# Use this when fixing UI bugs, incomplete interactions, or operator UX gaps in V1.1

---

## MANDATORY READ FIRST

Before touching any file:

- `docs/governance/constitution.md`
- `docs/SYSTEM_INVENTORY.md`
- `docs/v1.1/UI_SPEC.md`
- `docs/v1.1/UI_ENGINEERING_RULES.md`
- `docs/v1.1/UI_STATE_SCHEMA.md`
- `docs/v1.1/WORKSPACE_SPEC.md`
- `docs/v1.1/VIEW_LIFECYCLE.md`
- `docs/v1.1/ROUTING_SPEC.md`
- `docs/v1.1/PLATFORM_RENDERING_SPEC.md`
- `.agents/rules/autopost-rules.md`

Confirm with: **"Context loaded. Ready."**

---

## ARCHITECTURE FREEZE — READ THIS FIRST

ProofPost V1.1 architecture is **frozen**.

| Layer | Status |
|---|---|
| Backend | ✅ Stable — do not touch |
| Frontend architecture | ✅ Stable — do not touch |
| Store / Router | ✅ Frozen — do not rewrite |
| Lifecycle system | ✅ Frozen — do not replace |

**Current phase:** operator UX completion and interaction-system refinement only.

### NEVER do any of the following:
- Rewrite the store or router
- Replace vanilla JS with React / Vue / Tailwind
- Add any new frameworks or libraries
- Weaken CSP
- Modify dispatcher, extraction, or verification logic
- Break existing API contracts
- Touch backend files

### ONLY touch:
- `ui/views/*`
- `ui/components/*`
- `ui/styles/*`
- `ui/index.html`
- Onboarding / docs-related logic only

---

## What "Fix" Means in V1.1

The application works technically. Routing works. State works. Backend works.

The remaining problems are **interaction completeness and operator experience quality** — not architecture.

Every fix must move the UI from:
> "technically functional internal scaffold"

toward:
> "production-grade deterministic engineering operator console"

Reference feel: **Linear, GitHub, Grafana, observability tooling, security consoles.**
Not: flashy AI toy, startup gimmick, crypto dashboard.

---

## Diagnostic Steps

### Step 1 — Identify the exact surface
Name the view, component, or interaction that is broken or incomplete:
- Which view? (`dashboard`, `workspace`, `platforms`, `settings`, `docs`, `onboarding`)
- What is the specific failure? (non-functional button, broken empty state, missing validation, dead interaction, etc.)
- Is this a visual bug, a logic bug, or a missing feature?

### Step 2 — Read the relevant spec
Before writing a single line:
- Read the relevant spec file from the mandatory list above
- Confirm the expected behavior is documented
- If it's not documented, state that before proceeding

### Step 3 — Classify the problem

| Class | Description |
|---|---|
| **Non-functional interaction** | Button/link/TOC does nothing |
| **Missing validation** | Form allows unsafe progression |
| **Broken empty state** | No guidance shown when data is absent |
| **Broken loading state** | No skeleton/shimmer/indicator shown |
| **Dark mode artifact** | White/light bleed in dark theme |
| **Visual inconsistency** | Spacing, typography, or color out of system |
| **Missing micro-interaction** | No hover, transition, or feedback |
| **Incomplete operator guidance** | Missing helper text, labels, or descriptions |

### Step 4 — State the diagnosis
Write one sentence:
> "The [component/view] does X but should do Y per [spec reference]."

If you cannot write this clearly, keep reading before touching anything.

### Step 5 — Plan the fix
- What is the minimum change that resolves this?
- Does it touch only allowed files?
- Does it risk breaking any currently working interaction?
- Does it affect routing, state, or lifecycle? If yes — re-read the relevant spec before proceeding.

### Step 6 — Apply the fix
- Touch only the component or view that is broken
- Do not refactor unrelated code in the same file
- Do not change variable names, store shape, or router logic
- Do not add new abstractions unless the spec explicitly requires them
- Preserve all existing lifecycle hooks (`onActivate`, `onDeactivate`, etc.)

### Step 7 — Verify scope

Before outputting:

- [ ] Only allowed files were modified
- [ ] No framework or library introduced
- [ ] No store or router logic changed
- [ ] No CSP weakened
- [ ] No backend files touched
- [ ] No API contracts changed
- [ ] Lifecycle hooks preserved
- [ ] Dark mode consistency maintained
- [ ] Fix does not break any currently working view

### Step 8 — Output the fix report

```
VIEW/COMPONENT:   <file path>
PROBLEM CLASS:    <from classification table above>
DIAGNOSIS:        <one sentence — what was wrong>
FIX:              <one sentence — what was changed>
SPEC REFERENCE:   <which doc defined expected behavior>
SIDE EFFECTS:     <None / describe if any>
```

Then show the diff — changed lines only.

---

## Priority Fix Areas

Known incomplete areas in V1.1, in priority order:

### 1. Docs System
- TOC navigation buttons must function (smooth scroll + active highlight)
- Content must be broken into cards/sections, not rendered as a text dump
- Collapsible sections where appropriate
- Quick Start section at top
- Troubleshooting surface
- Onboarding guidance callouts

### 2. Setup / Onboarding Validation
- Required fields must block progression when empty
- Inline validation errors on blur
- Connection test states (loading → success / failure)
- First-run guidance copy
- Wizard must feel safe and guided, not skippable

### 3. Dashboard
- Stronger visual hierarchy
- Better telemetry/status cards
- Meaningful empty states with actionable guidance
- Subtle hover interactions
- Loading states for all async surfaces

### 4. Platforms Page
- Real adapter cards for Bluesky and LinkedIn
- Connected / disconnected states with status badges
- Test connection button per platform
- Professional "coming soon" placeholders for Reddit, Threads, Mastodon, X
- Empty state: "No platforms connected. Connect Bluesky to begin publishing."

### 5. Micro-interactions
- Hover transitions on all interactive cards
- Route fade between views
- Button press feedback
- Loading shimmer on async loads
- Toast animation
- All transitions: subtle, fast, professional
- Respect `prefers-reduced-motion`

### 6. Empty States
Every view must have a polished, actionable empty state. Examples:
- "No pending facts yet. Push a commit to generate your first review."
- "No platforms connected. Connect Bluesky to begin publishing."

### 7. Settings
- Better form grouping and hierarchy
- Inline validation
- Save success feedback
- No white/light artifacts in dark mode

---

## Operator Experience Standard

Every fix must move the product toward this standard:

The UI should feel **trustworthy, calm, operational, professional, and deterministic.**

It should **not** feel: flashy, chaotic, unfinished, or AI-generated.

When in doubt: ask "would this feel at home in Linear, GitHub, or Grafana?" If no — reconsider.

---

## When to Stop and Escalate

Stop and report instead of fixing if:

- The fix requires touching backend, dispatcher, or extraction logic
- The fix requires changing the store schema or router
- The fix requires a new framework or library
- The fix touches more than one view without a clear documented reason
- You cannot write a clear one-sentence diagnosis

Output a **Blocked Report**:

```
BLOCKED
REASON:    <why this cannot be fixed within allowed scope>
REQUIRED:  <what decision or spec update is needed first>
```