# ProofPost V1.1 — Master Implementation Prompts
# docs/v1.1/prompt.md

This document contains a sequence of production-grade prompts designed to guide an AI agent through the full implementation of ProofPost V1.1. 

---

## 🛑 HOW TO USE THESE PROMPTS
1. **Follow the Order**: Do NOT skip phases.
2. **One at a Time**: Execute one prompt per session.
3. **Verify First**: Before starting a new prompt, use `/ui-review` to verify the previous work.

---

## 🏗️ PHASE A: THE FOUNDATION

### PROMPT A1: Design System & Base Styling
**Goal**: Establish the design tokens and layout primitives.
**Target Files**: `ui/styles/tokens.css`, `ui/styles/base.css`, `ui/styles/layout.css`
**Git Commit**: `git commit -m "feat(ui): implement design tokens and layout primitives"`


```text
/build-component
READ FIRST: docs/v1.1/UI_SPEC.md (Design System section)
READ FIRST: docs/v1.1/UI_ENGINEERING_RULES.md (CSS Rules section)

GOAL: Implement the V1.1 Design System.
1. Create ui/styles/tokens.css with all variables (colors, spacing, radius, typography).
2. Implement Dark (default) and Light theme blocks.
3. Create ui/styles/base.css with resets and typography defaults.
4. Create ui/styles/layout.css defining the App Shell grid (Sidebar + Topbar + Main Stage).

CONSTRAINTS:
- No hardcoded hex values. Use tokens only.
- No Shadow DOM.
- Use CSS Grid for layout.
```

---

### PROMPT A2: The Reactive Store
**Goal**: Create the single source of truth for the frontend.
**Target File**: `ui/store.js`
**Git Commit**: `git commit -m "feat(ui): implement proxy-based reactive store"`


```text
/build-module
READ FIRST: docs/v1.1/UI_STATE_SCHEMA.md
READ FIRST: docs/v1.1/UI_ENGINEERING_RULES.md (State Management section)

GOAL: Implement the Proxy-based reactive store.
1. Define the initial state object exactly as specified in docs/v1.1/UI_STATE_SCHEMA.md.
2. Implement a JavaScript Proxy to watch for state changes.
3. Create the 'actions' object for all mutations.
4. Implement draft rehydration logic (save/load workspace drafts from localStorage).

CONSTRAINTS:
- No direct state mutations allowed outside the actions object.
- Never store secrets or tokens in localStorage.
```

---

### PROMPT A3: The Router & Guards
**Goal**: Implement clean URL routing and onboarding protection.
**Target File**: `ui/router.js`
**Git Commit**: `git commit -m "feat(ui): implement vanilla history router and guards"`


```text
/build-module
READ FIRST: docs/v1.1/ROUTING_SPEC.md
READ FIRST: docs/v1.1/UI_SPEC.md (Routing section)

GOAL: Implement the vanilla History API router.
1. Define all ROUTES constants.
2. Implement navigate() and pushState handling.
3. Implement the Onboarding Guard: If setupComplete is false, redirect to /setup.
4. Integrate with store.js to clean up view lifecycles on route change.

CONSTRAINTS:
- No hash routing (#/).
- Must trigger onDeactivate() for the outgoing view.
```

---

### PROMPT A4: The API Integration Layer
**Goal**: Secure and standardized communication with the FastAPI backend.
**Target File**: `ui/api.js`
**Git Commit**: `git commit -m "feat(ui): implement central api integration layer"`


```text
/build-module
READ FIRST: docs/v1.1/UI_API_INTEGRATION.md
READ FIRST: docs/API_CONTRACTS.md

GOAL: Implement the central api.js wrapper.
1. Create async wrappers for all endpoints (health, facts, approve, settings, etc.).
2. Implement the Canonical Error Object handling for all failures.
3. Implement secret masking: Never send **** back to the server.
4. Use window.location.origin as the base URL.

CONSTRAINTS:
- No fetch() calls allowed anywhere else in the project.
- Must return { success: bool, data: any, error: object }.
```

---

## 🖼️ PHASE B: THE OPERATIONAL LAYER

### PROMPT B1: App Shell & Dashboard
**Goal**: Build the main entry point and health overview.
**Target Files**: `ui/index.html`, `ui/views/dashboard.js`
**Git Commit**: `git commit -m "feat(ui): build app shell and dashboard view"`


```text
/build-view
READ FIRST: docs/v1.1/UI_SPEC.md (App Shell & Dashboard sections)
READ FIRST: docs/v1.1/VIEW_LIFECYCLE.md

GOAL: Build the App Shell and Dashboard view.
1. Create ui/index.html with Nav sidebar and View container.
2. Implement dashboard.js with health status dots and pending counts.
3. Implement onActivate() polling for backend health.
4. Implement onDeactivate() to clear all polling.

CONSTRAINTS:
- Views MUST render from store state, never directly from API responses.
- Components used must be from the approved catalog.
```

---

### PROMPT B2: The Workspace (The Heart)
**Goal**: Implement the fact review and approval interface.
**Target File**: `ui/views/workspace.js`
**Git Commit**: `git commit -m "feat(ui): implement workspace fact review interface"`


```text
/build-view
READ FIRST: docs/v1.1/WORKSPACE_SPEC.md
READ FIRST: docs/v1.1/WORKSPACE_STATE_MACHINE.md
READ FIRST: docs/v1.1/PLATFORM_RENDERING_SPEC.md

GOAL: Build the core review workspace.
1. Implement the split view: Fact List (left) and Review Panel (right).
2. Implement platform preview tabs (Bluesky/LinkedIn).
3. Implement the Verification Evidence panel.
4. Implement the Approval Action Guard: Prevent duplicate clicks/dispatches.
5. Integrate localStorage draft rehydration.

CONSTRAINTS:
- approveFact() must early-return if dispatching === true.
- Display "Large edits detected" if draft differs significantly from original.
```

---

## 🛠️ PHASE C: REFINEMENT

### PROMPT C1: Setup Wizard & Settings
**Goal**: Onboarding and secure configuration management.
**Target Files**: `ui/views/setup.js`, `ui/views/settings.js`
**Git Commit**: `git commit -m "feat(ui): build setup wizard and settings views"`


```text
/build-view
READ FIRST: docs/v1.1/UI_SPEC.md (Setup & Settings sections)
READ FIRST: docs/v1.1/UI_SECURITY_MODEL.md (Legacy ref for masking)

GOAL: Build the onboarding and configuration views.
1. Implement the step-by-step setup wizard with validation.
2. Build the tabbed Settings view (AI, Ingestion, Environment).
3. Ensure API keys are rendered as password inputs with show/hide toggles.
4. Implement "Danger Zone" for database/settings reset.

CONSTRAINTS:
- Use pp-modal for all destructive confirmations.
- Redirect to /dashboard ONLY after setup is 100% complete.
```

---

## 🧪 FINAL VALIDATION PROMPT
**Goal**: Ensure zero drift before deployment.

```text
/ui-review
READ FIRST: docs/v1.1/UI_ENGINEERING_RULES.md (Definition of Done)
READ FIRST: docs/V1_COMPLETION_PLAN.md

GOAL: Final architectural audit of the V1.1 implementation.
1. Check for Shadow DOM usage (forbidden).
2. Check for direct DOM mutations in components.
3. Check for fetch() calls outside api.js.
4. Check for state-to-rendering discipline.
5. Verify keyboard navigation across all views.
```
