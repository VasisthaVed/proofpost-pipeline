# ProofPost — UI State Schema
# docs/v1.1/UI_STATE_SCHEMA.md

---

# PURPOSE

This document defines the authoritative frontend state schema for ProofPost V1.1.

Goals:
- Prevent frontend state drift
- Prevent hidden state mutations
- Define ownership and lifecycle
- Define persistence boundaries
- Keep rendering deterministic

ALL frontend state must exist in store.js and follow this schema.

Views render FROM state.
Views never own authoritative state.

---

# ROOT STATE OBJECT

```javascript
state = {
  app: {},
  ui: {},
  workspace: {},
  observability: {},
  settings: {},
  platforms: {},
  history: {}
}
```

---

# STATE RULES

1. State may only mutate through actions
2. Views never mutate state directly
3. Components never mutate state
4. API responses never directly render DOM
5. State is the single source of truth
6. Derived state must never be persisted
7. Secrets never stored in localStorage
8. Temporary UI state belongs in ui section only

---

# APP STATE

Global application runtime state.

```javascript
app: {
  initialized: false,
  loading: false,
  route: 'dashboard',
  setupComplete: false,
  apiOnline: false,
  version: 'v1.1',
  theme: 'dark',
  lastHealthCheck: null
}
```

| Property        | Type      | Owner          | Persistence |
| --------------- | --------- | -------------- | ----------- |
| initialized     | boolean   | app bootstrap  | runtime     |
| loading         | boolean   | actions        | runtime     |
| route           | string    | router         | runtime     |
| setupComplete   | boolean   | setup flow     | persisted   |
| apiOnline       | boolean   | health polling | runtime     |
| version         | string    | build metadata | static      |
| theme           | string    | user settings  | persisted   |
| lastHealthCheck | timestamp | health poller  | runtime     |

---

# UI STATE

Ephemeral interface state only.

```javascript
ui: {
  activeModal: null,
  sidebarCollapsed: false,
  toastQueue: [],
  focusedFactId: null,
  keyboardMode: false,
  globalError: null
}
```

This state:

* must NEVER affect backend logic
* resets safely
* may be discarded anytime

---

# WORKSPACE STATE

Core review workspace state.

```javascript
workspace: {
  selectedFactId: null,
  selectedPlatform: 'bluesky',

  facts: [],
  loading: false,
  error: null,

  draftContent: '',
  originalContent: '',
  hasUnsavedChanges: false,

  verificationExpanded: true,

  dispatching: false,
  dispatchResult: null
}
```

---

# WORKSPACE STATE RULES

draftContent:

* editable
* operator-controlled

originalContent:

* immutable renderer output

hasUnsavedChanges:

* computed after edit

selectedPlatform:

* controls preview renderer only
* never changes verification evidence

---

# OBSERVABILITY STATE

```javascript
observability: {
  events: [],
  polling: false,
  lastEventId: null,
  connectionStatus: 'online'
}
```

Events are append-only runtime telemetry.

Views may:

* filter
* group
* paginate

Views may NOT:

* mutate event history

---

# SETTINGS STATE

```javascript
settings: {
  loaded: false,

  ai: {
    provider: '',
    model: ''
  },

  ingestion: {
    hmacConfigured: false
  },

  ui: {
    onboardingComplete: false
  }
}
```

NEVER store:

* raw API keys
* tokens
* passwords

Backend owns secrets.

Frontend only knows:

* configured or not
* validation state

---

# PLATFORM STATE

```javascript
platforms: {
  items: [],
  loading: false,
  error: null
}
```

Platform object:

```javascript
{
  id: 'bluesky',
  connected: true,
  lastChecked: timestamp,
  status: 'healthy'
}
```

---

# HISTORY STATE

```javascript
history: {
  items: [],
  loading: false,
  error: null,
  filters: {
    platform: 'all',
    status: 'all'
  }
}
```

---

# DERIVED STATE RULES

Derived state must NEVER be persisted.

Examples:

```javascript
pendingCount
onlinePlatforms
filteredHistory
workspaceWarnings
```

Derived state should use pure selector functions.

---

# ACTION DISCIPLINE

VALID:

```javascript
actions.setPendingFacts(facts)
actions.selectFact(id)
actions.updateHealth(status)
```

INVALID:

```javascript
store.workspace.facts = facts
```

---

# RESET RULES

Workspace resets:

* on successful dispatch
* on route exit
* on rejected fact

Observability never resets during runtime.

UI state may safely reset anytime.

---

## DRAFT REHYDRATION

Workspace draftContent rehydrates from localStorage on page refresh, keyed by selectedFactId.
This ensures no operator work is lost during accidental navigation or refresh.

---

# LOCAL STORAGE RULES

Allowed:

* theme
* onboardingComplete
* sidebarCollapsed

* verification evidence

---

## PERSISTENCE POLICY

Allowed in localStorage:
* theme
* onboardingComplete
* sidebarCollapsed
* workspace.draftContent (keyed by selectedFactId)

Forbidden in localStorage:
* API keys
* tokens
* rendered posts
* verification evidence

---

# FUTURE V2 EXTENSION POINTS

Reserved:

```javascript
memory: {}
analytics: {}
releases: {}
multiUser: {}
```

V2 extends state.
V2 does not rewrite state architecture.
