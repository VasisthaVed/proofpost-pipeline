# ProofPost UI Architecture
# docs/ui/UI_ARCHITECTURE.md

## SINGLE FILE ARCHITECTURE

The entire UI is one file: ui/index.html
CSS and JS are embedded. No external files. No build step.
Run python main.py → open browser → everything works.

## VIEW SYSTEM

Views are divs. One visible at a time.
Navigation switches visibility. No routing library.

```
#view-dashboard   default on load
#view-pending     facts awaiting approval
#view-history     dispatched posts
#view-platforms   platform connection status
#view-settings    API keys and config
```

## STATE MODEL

One global state object. Never mutated directly.
Always replaced via setState().

```javascript
const state = {
  currentView: 'dashboard',
  loading: false,
  error: null,
  data: {
    health: null,
    pending: [],
    history: [],
    platforms: [],
    settings: null
  }
}
```

## API LAYER

One function per endpoint. All return structured responses.
All errors caught and surfaced — never swallowed.

```javascript
const API = {
  base: 'http://localhost:7821',

  async get(path) { ... },
  async post(path, body) { ... },

  async getHealth()            → GET /health
  async getPending()           → GET /api/facts/pending
  async approveFact(id)        → POST /api/facts/{id}/approve
  async rejectFact(id)         → POST /api/facts/{id}/reject
  async getHistory()           → GET /api/history
  async getPlatforms()         → GET /api/platforms
  async testPlatform(id)       → POST /api/platforms/{id}/test
  async getSettings()          → GET /api/settings
  async saveSettings(data)     → POST /api/settings
}
```

## RENDER SYSTEM

Pure functions. Take state, return HTML string.
No direct DOM mutation outside the render cycle.

```javascript
function render(state) {
  renderNav(state.currentView)
  renderView(state.currentView, state.data)
  renderError(state.error)
  renderLoading(state.loading)
}
```

## EVENT SYSTEM

All events delegated to document level.
No inline onclick handlers.
Data attributes carry intent.

```html
<button data-action="approve" data-id="fact-123">Approve</button>
```

```javascript
document.addEventListener('click', (e) => {
  const action = e.target.dataset.action
  const id = e.target.dataset.id
  if (action === 'approve') handleApprove(id)
})
```

## POLLING

Dashboard and Pending views auto-refresh every 15 seconds.
Polling stops when view changes.
Polling stops when tab is not visible (visibilitychange API).

## ERROR DISPLAY

All errors surface to #error-banner.
Banner auto-dismisses after 5 seconds.
Critical errors (backend offline) stay until resolved.
