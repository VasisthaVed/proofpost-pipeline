# ProofPost V1.1 — UI Engineering Rules
# docs/v1.1/UI_ENGINEERING_RULES.md
# This is the frontend constitution.
# Anti-Gravity reads this before every UI session.
# These rules do NOT change during V1.1 development.

---

## WHAT THIS DOCUMENT IS

This document defines the engineering discipline for ProofPost's frontend.
It exists because AI-assisted UI development drifts without constraints.
Every rule exists for a specific reason. None are optional.

---

## THE FIVE LAWS (NEVER VIOLATED)

### LAW 1 — No direct DOM mutations outside view files
```javascript
// FORBIDDEN anywhere except views/*.js
document.getElementById('fact-summary').textContent = 'new text'
element.style.color = 'red'
element.classList.add('hidden')

// CORRECT — mutate state, let views handle DOM
actions.updateFactSummary(factId, 'new text')
actions.setError('Something went wrong')
```
Views own the DOM. Everything else owns state.

### LAW 2 — No fetch() outside api.js
```javascript
// FORBIDDEN in views, components, store, anywhere
const data = await fetch('/api/facts/pending')

// CORRECT
import { api } from '../api.js'
const data = await api.getPendingFacts()
```
api.js is the only file that knows the backend exists.

### LAW 3 — No store mutations outside actions
```javascript
// FORBIDDEN — direct proxy mutation from views
store.pendingFacts = newFacts
store.health.status = 'online'

// CORRECT — only through actions
actions.setPendingFacts(newFacts)
actions.updateHealth(healthData)
```
State changes are traceable. Every mutation has a name.

### LAW 4 — No hardcoded values
```javascript
// FORBIDDEN
element.style.color = '#6366F1'
fetch('http://localhost:7821/api/facts/pending')
router.navigate('/workspace')

// CORRECT
element.style.color = 'var(--brand-primary)'
fetch(`${config.API_BASE}/api/facts/pending`)
router.navigate(ROUTES.WORKSPACE)
```
Colors come from tokens.css.
URLs come from api.js.
Routes come from router.js constants.

### LAW 5 — No business logic inside components
```javascript
// FORBIDDEN inside pp-fact-card.js
async approveFact(id) {
  const response = await fetch('/api/facts/' + id + '/approve')
  store.pendingFacts = store.pendingFacts.filter(f => f.id !== id)
}

// CORRECT — component dispatches event, view handles logic
this.dispatchEvent(new CustomEvent('fact-approve', { detail: { id } }))
// workspace.js listens and calls actions.approveFact(id)
```
Components are display units. Views are logic units.

---

## ARCHITECTURE RULES

### State Management
- One store.js file. One state object. No exceptions.
- All mutations through actions object only.
- Actions are pure functions that call api.js then update store.
- Store uses JavaScript Proxy for reactivity.
- No component-level state for data that belongs in the store.
- Component-level state ONLY for: is this dropdown open, is this field focused.

### Action naming convention:
```javascript
// Data actions
actions.setPendingFacts(facts)
actions.appendHistoryItems(items)
actions.updateHealth(data)
actions.clearError()

// UI actions
actions.selectFact(id)
actions.setView(viewName)
actions.setTheme('dark' | 'light')
actions.setLoading(bool)

// Async actions (these call api.js)
actions.loadPendingFacts()    // fetch + setPendingFacts
actions.approveFact(id)       // api call + remove from pending
actions.rejectFact(id)        // api call + remove from pending
actions.saveSettings(data)    // api call + update settings in store
```

### Routing Rules
- router.js defines ALL valid routes as constants.
- Route guards run before every navigation.
- If setup incomplete: redirect /setup (except /settings and /docs).
- If backend offline: show offline banner, do not redirect.
- Browser back/forward must work correctly.
- No hash routing (#/workspace) — use History API only.

### Component Rules
- Custom Elements only for: reusable, behavior-heavy, state-isolated UI.
- Do NOT create a Web Component for: a button, a label, a badge, a divider.
- Component list is fixed for V1.1:
  - pp-status-dot
  - pp-fact-card
  - pp-platform-card
  - pp-toast
  - pp-modal
  - pp-loading
  - pp-empty-state
- Adding a new component requires explicit justification.
- Components communicate UP via CustomEvents only.
- Components receive data via attributes and properties only.

### CSS Rules
- All colors via CSS variables from tokens.css only.
- No inline styles anywhere.
- No hardcoded hex values outside tokens.css.
- No !important.
- Component styles scoped to component file using BEM-lite class prefixes.
- Shadow DOM is forbidden in V1.1. All components render into light DOM.
- Class naming: BEM-lite — block__element--modifier.
  Example: .fact-card__summary--edited

### API Rules
- api.js wraps every endpoint in a named async function.
- Every function handles its own error and returns structured result.
- Never let a raw fetch() error bubble to a view.
- Return shape: { success: bool, data: any, error: string | null }
- Loading state set before call, cleared after (success or failure).

---

## DRAFT STATE RULES

The Workspace view has editable content. Users will edit facts.
Unsaved changes must be tracked and protected.

Rules:
- store.draftFact tracks current edits to the selected fact.
- store.draftModified = true when any edit is made.
- Navigating away when draftModified = true shows confirmation modal.
- "Approve" uses draftFact content, not original fact content.
- "Reset" restores original fact content and sets draftModified = false.
- Draft is cleared on approve, reject, or explicit reset.
- Draft is NOT persisted to backend — it lives in memory only.

---

## SECURITY RULES

- All API calls use window.location.origin as base URL.
- CSP in index.html: connect-src 'self' only.
- All content from API rendered via textContent or escapeHtml().
- Never innerHTML with data from API responses.
- No eval(), no Function(), no document.write().
- API keys rendered as password inputs.
- If user submits **** in a key field: do not send to backend.
  api.js filters masked values before POST.
- No credentials stored in localStorage or sessionStorage.

---

## NOTIFICATION RULES

V1.1 uses toast notifications only. No persistent notification center.

Toast rules:
- Success: green, auto-dismiss after 3 seconds.
- Warning: amber, auto-dismiss after 5 seconds.
- Error: red, manual dismiss only (user must see it).
- Max 3 toasts visible at once. Oldest dismissed first.
- Toast text must be plain English. No technical jargon.
- One pp-toast component instance manages the queue.

Notification center (persistent) is V1.2.

---

## OBSERVABILITY RULES

V1.1 observability is a timeline list, not a live animated graph.
Animation comes in Phase D polish after all views are functional.

Timeline rules:
- Group events by pipeline session (one webhook = one session).
- Sessions collapsed by default, expanded on click.
- Each session shows: timestamp, webhook hash, outcome status.
- Expanded session shows: each pipeline step with timing.
- Auto-refresh every 10 seconds.
- Maximum 50 sessions displayed. Paginate beyond that.

---

## DEFINITION OF DONE FOR UI SESSIONS

A UI session is NOT done until:
- [ ] No direct DOM mutations outside view files
- [ ] No fetch() outside api.js
- [ ] No store mutations outside actions
- [ ] No hardcoded colors (grep for #[0-9a-fA-F]{3,6})
- [ ] No hardcoded URLs (grep for localhost or 7821)
- [ ] No inline styles
- [ ] No business logic in components
- [ ] Keyboard navigation works for interactive elements
- [ ] Loading states shown during API calls
- [ ] Error states shown when API calls fail
- [ ] Empty states shown when lists are empty
- [ ] Dark and light theme both render correctly
- [ ] Route guards working (setup redirect if needed)
- [ ] Draft state protected in Workspace (if applicable)

---

## BUILD ORDER (MANDATORY SEQUENCE)

Phase A — Foundation (must complete before anything else):
1. tokens.css (design tokens — colors, fonts, spacing)
2. base.css (reset + body)
3. store.js (state object + Proxy + actions skeleton)
4. router.js (routes constants + History API + guards)
5. api.js (all endpoint wrappers)
6. index.html (app shell — nav + layout only, no views)
7. layout.css (sidebar + topbar + main stage)
8. Verify: navigation works, theme switch works, no views yet

Phase B — Core Views:
9.  dashboard.js + styles
10. workspace.js + styles (most important — take most time)
11. settings.js + styles (must work perfectly)
12. platforms.js + styles

Phase C — Experience Views:
13. setup.js (onboarding wizard)
14. observability.js (pipeline timeline)
15. history.js (dispatch archive)
16. docs.js (embedded documentation)

Phase D — Polish:
17. Keyboard shortcuts system
18. CSS animations and transitions
19. Mobile responsive pass
20. Accessibility audit
21. Light theme polish
22. Performance pass

DO NOT start Phase B before Phase A is complete and tested.
DO NOT start Phase C before Phase B core views work end to end.
DO NOT add features from Phase D during Phases A-C.

---

## WHAT ANTI-GRAVITY MUST DO BEFORE EVERY UI SESSION

1. Read docs/governance/constitution.md
2. Read docs/v1.1/UI_ENGINEERING_RULES.md (this file)
3. Read docs/v1.1/UI_SPEC.md
4. Read the specific view spec if building a view
5. State which phase and step you are building
6. State which files are ALLOWED and FORBIDDEN
7. Confirm the 5 Laws before writing code

Failure to follow this order produces: drift.

---

## LIFECYCLE CLEANUP RULES

All intervals/timeouts must be cleaned in onDeactivate().
No polling timer may survive route exit.

---

## ACTION GUARDS

actions.approveFact() must early-return if:
store.workspace.dispatching === true