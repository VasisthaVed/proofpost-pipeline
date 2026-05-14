Rule 1 ( your task is to make this all together  into senses and suggest changes in the file system for v1.1 or anything)
rule 2 ( do not touch any code or any other files)  
rule 3  ( the system should make sure to not change any fiels and report on what they did what they build and what they added   )
rule 4  ( any permission u need mention what and why u need it )

here is the thingy 

# CREATE THESE FILES

```text id="分快三653"
docs/v1.1/UI_STATE_SCHEMA.md
```

Why:
Defines authoritative frontend state structure and mutation discipline.

---

```text id="分快三654"
docs/v1.1/UI_API_INTEGRATION.md
```

Why:
Locks frontend ↔ backend API contracts.

---

```text id="分快三655"
docs/v1.1/WORKSPACE_SPEC.md
```

Why:
Defines the core ProofPost review/approval workspace behavior.

---

```text id="分快三656"
docs/v1.1/UI_COMPONENT_CATALOG.md
```

Why:
Prevents component sprawl and responsibility drift.

---

```text id="分快三657"
docs/v1.1/VIEW_LIFECYCLE.md
```

Why:
Prevents memory leaks, polling leaks, zombie listeners.

---

```text id="分快三658"
docs/v1.1/WORKSPACE_STATE_MACHINE.md
```

Why:
Defines all valid review/approval/dispatch states.

---

```text id="分快三659"
docs/v1.1/PLATFORM_RENDERING_SPEC.md
```

Why:
Defines how one verified fact transforms per platform.

---

```text id="分快三660"
.agents/workflows/ui-review.md
```

Why:
Frontend equivalent of architecture-review.

---

# UPDATE THESE EXISTING FILES

```text id="分快三661"
.agents/rules/autopost-rules.md
```

Add:

```text id="分快三662"
21. Views may only render from store state — never directly from API responses
```

Why:
Prevents hidden UI state drift.

---

```text id="分快三663"
docs/v1.1/UI_ENGINEERING_RULES.md
```

Add:

```text id="分快三664"
All intervals/timeouts must be cleaned in onDeactivate().
No polling timer may survive route exit.
```

Why:
Prevents SPA memory leaks.

---

```text id="分快三665"
.agents/workflows/build-module.md
```

Add:

```text id="分快三666"
Frontend work must use /build-view or /build-component workflows.
```

Why:
Separates backend and frontend governance.

---

# IMPORTANT

Standardize ALL paths to:

```text id="分快三667"
docs/v1.1/
```

NOT:

```text id="分快三668"
docs/v11/
```

Fix this before continuing.

---

# FINAL NOTE

These docs do NOT make the codebase unstable.

They do the opposite:

```text id="分快三669"
they stabilize future AI-generated code
```

before V1.1 complexity explodes.
    -------------------------------------------Here is the infomation----------------------------------




# File 1

Path:

```text id="分快三645"
docs/v1.1/UI_STATE_SCHEMA.md
```

````md
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
````

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

# LOCAL STORAGE RULES

Allowed:

* theme
* onboardingComplete
* sidebarCollapsed

Forbidden:

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

````

---

# File 2
Path:
```text id="分快三646"
docs/v1.1/UI_API_INTEGRATION.md
````

````md
# ProofPost — UI API Integration
# docs/v1.1/UI_API_INTEGRATION.md

---

# PURPOSE

Defines the contract between frontend views and backend API routes.

Goals:
- Prevent frontend/backend drift
- Define ownership boundaries
- Standardize action flow
- Keep rendering deterministic

Views NEVER consume raw API responses directly.
Flow is always:

API → actions → store → render

---

# INTEGRATION RULES

1. All fetch calls go through api.js
2. Views never call fetch directly
3. API responses must mutate store through actions only
4. Components never know API exists
5. Failed requests must produce UI error states

---

# HEALTH ENDPOINT

Route:
GET /health

Used by:
- dashboard
- observability
- setup validation

Store action:
```javascript
actions.updateHealth(payload)
````

State targets:

```javascript
app.apiOnline
app.lastHealthCheck
```

---

# PENDING FACTS

Route:
GET /api/facts/pending

Used by:

* workspace
* dashboard

Store action:

```javascript
actions.setPendingFacts(payload.items)
```

State targets:

```javascript
workspace.facts
```

---

# APPROVE FACT

Route:
POST /api/facts/{id}/approve

Used by:

* workspace

Store action:

```javascript
actions.markFactApproved(id)
```

Expected flow:

```text
approve click
→ loading state
→ API success
→ store update
→ UI rerender
→ toast success
```

---

# REJECT FACT

Route:
POST /api/facts/{id}/reject

Store action:

```javascript
actions.removeFact(id)
```

---

# HISTORY

Route:
GET /api/history

Used by:

* history view

Store action:

```javascript
actions.setHistory(payload.items)
```

---

# SETTINGS

Route:
GET /api/settings

Store action:

```javascript
actions.loadSettings(payload)
```

---

# SAVE SETTINGS

Route:
POST /api/settings

Rules:

* UI sends validated payload only
* backend validates authoritative schema
* backend persists configuration

Frontend NEVER edits settings.json directly.

---

# PLATFORM STATUS

Route:
GET /api/platforms

Store action:

```javascript
actions.setPlatforms(payload.items)
```

---

# TEST PLATFORM

Route:
POST /api/platforms/{id}/test

Result:
temporary runtime validation only

Must display:

* success
* latency
* failure reason

---

# PREVIEW RENDERING (V1.1)

Route:
GET /api/facts/{id}/preview?platform=bluesky

Used by:

* workspace preview

Store action:

```javascript
actions.setRenderedPreview(payload)
```

---

# OBSERVABILITY (V1.1)

Route:
GET /api/events

Store action:

```javascript
actions.appendEvents(payload)
```

Events append only.

---

# ERROR HANDLING

Every API call must support:

* loading
* success
* empty
* error

No silent failures allowed.

---

# RESPONSE OWNERSHIP

Backend owns:

* validation
* persistence
* secrets
* verification
* rendering authority

Frontend owns:

* presentation
* interaction
* temporary edits
* workspace flow

---

# SECURITY RULES

Frontend NEVER:

* stores secrets
* bypasses validation
* directly modifies filesystem
* assumes trust

Backend is authoritative.

````

---

# File 3
Path:
```text id="分快三647"
docs/v1.1/WORKSPACE_SPEC.md
````

````md
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
````

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
| J / K      | Navigate facts |
| Tab        | Move focus     |
| Ctrl+Enter | Approve        |
| Esc        | Close modal    |
| Cmd/Ctrl+S | Save draft     |

---

# SAFETY RULES

Workspace NEVER:

* auto approves
* auto dispatches
* hides verification evidence
* silently mutates drafts

Human remains authoritative.

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

````

---

# File 4
Path:
```text id="分快三648"
docs/v1.1/UI_COMPONENT_CATALOG.md
````

````md
# ProofPost — UI Component Catalog
# docs/v1.1/UI_COMPONENT_CATALOG.md

---

# PURPOSE

Defines all approved Web Components in ProofPost V1.1.

Goals:
- prevent component sprawl
- prevent responsibility drift
- standardize behavior
- enforce accessibility

Components are display units only.

They:
- receive data
- render data
- emit events

They NEVER:
- fetch data
- mutate store
- contain business logic

---

# COMPONENT RULES

All components:
- extend HTMLElement
- use CustomEvents only
- support dark/light themes
- render gracefully with missing data
- use tokens.css variables only

---

# APPROVED COMPONENTS

---

# pp-status-dot

Purpose:
display runtime status visually.

Attributes:
```html
status="online|offline|warning"
label="Backend"
````

Events:
none

Forbidden:

* polling
* API calls

---

# pp-fact-card

Purpose:
render pending fact summary.

Attributes:

```html
summary=""
confidence=""
type=""
timestamp=""
```

Events:

```text
pp-select
pp-approve
pp-reject
```

Forbidden:

* dispatch logic
* rendering platform previews

---

# pp-platform-card

Purpose:
render platform health and status.

Attributes:

```html
platform="bluesky"
connected="true"
status="healthy"
```

Events:

```text
pp-test-platform
```

---

# pp-toast

Purpose:
temporary user feedback.

Variants:

* success
* error
* warning
* info

Forbidden:

* persistence
* logging

---

# pp-modal

Purpose:
generic modal container.

Responsibilities:

* focus trapping
* keyboard escape
* overlay rendering

Forbidden:

* business logic

---

# pp-loading

Purpose:
render loading skeletons.

Modes:

* card
* list
* workspace

---

# pp-empty-state

Purpose:
render intentional empty states.

Attributes:

```html
title=""
message=""
action=""
```

---

# ACCESSIBILITY RULES

All components must:

* support keyboard navigation
* expose ARIA labels
* support focus outlines
* preserve contrast ratios
* avoid motion-only feedback

---

# EVENT RULES

Components emit UP only.

VALID:

```javascript
dispatchEvent(new CustomEvent())
```

INVALID:

```javascript
store.update()
fetch()
router.navigate()
```

---

# FUTURE COMPONENTS REQUIRE REVIEW

New components require:

* justification
* responsibility definition
* event contract
* accessibility review

````

---

# File 5
Path:
```text id="分快三649"
docs/v1.1/VIEW_LIFECYCLE.md
````

````md
# ProofPost — View Lifecycle
# docs/v1.1/VIEW_LIFECYCLE.md

---

# PURPOSE

Defines the lifecycle contract for all ProofPost frontend views.

Goals:
- prevent memory leaks
- prevent duplicate polling
- standardize activation flow
- standardize cleanup

Every view follows the same lifecycle.

---

# VIEW CONTRACT

Every view exports:

```javascript
render(container, state)
onActivate()
onDeactivate()
````

---

# RENDER()

Purpose:
pure UI rendering from state.

Rules:

* no fetch calls
* no intervals
* no global mutations
* deterministic output only

Input:

```javascript
(container, state)
```

Output:
DOM rendering only.

---

# ONACTIVATE()

Purpose:
start runtime behaviors.

Allowed:

* polling
* subscriptions
* listeners
* timers

Examples:

```javascript
startHealthPolling()
subscribeToStore()
```

---

# ONDEACTIVATE()

Purpose:
clean shutdown.

Must cleanup:

* intervals
* timeouts
* subscriptions
* listeners
* observers

---

# HARD RULE

No timer may survive route exit.

INVALID:

```javascript
setInterval(() => {}, 5000)
```

without:

```javascript
clearInterval()
```

---

# POLLING RULES

Polling only allowed in:

* dashboard
* observability
* workspace

Polling must stop immediately on deactivate.

---

# SUBSCRIPTION RULES

Views may subscribe to store updates.

Views MUST unsubscribe on deactivate.

---

# MEMORY SAFETY

Views must not:

* retain stale DOM references
* retain orphan listeners
* retain old state snapshots

---

# ROUTE TRANSITION FLOW

```text
Current View
→ onDeactivate()
→ DOM cleanup
→ route switch
→ new render()
→ new onActivate()
```

---

# ERROR RECOVERY

If view crashes:

* show fallback error state
* log structured error
* preserve app shell

App shell must never crash entirely because one view failed.

---

# FOCUS MANAGEMENT

On route change:

* focus resets to primary heading
* keyboard navigation preserved

Modals must:

* trap focus
* restore focus on close

---

# FUTURE V2 SUPPORT

Lifecycle designed for:

* live event streams
* websocket upgrades
* collaborative views
* persistent sessions

```
```
# File 6

Path:

```text id="分快三650"
docs/v1.1/WORKSPACE_STATE_MACHINE.md
```

````md id="9y7cx4"
# ProofPost — Workspace State Machine
# docs/v1.1/WORKSPACE_STATE_MACHINE.md

---

# PURPOSE

Defines the authoritative lifecycle of a fact inside the ProofPost Workspace.

Goals:
- deterministic operator flow
- safe approval boundaries
- observable transitions
- predictable UI behavior

The workspace is state-driven.
All UI behavior must map to these states.

---

# CORE PRINCIPLE

A fact is never:
- auto-approved
- auto-dispatched
- silently modified

Human approval remains authoritative.

---

# PRIMARY STATE FLOW

```text
PENDING
→ SELECTED
→ REVIEWING
→ EDITING
→ READY
→ APPROVING
→ DISPATCHING
→ DISPATCHED
````

Failure branches:

```text
READY
→ REJECTED

DISPATCHING
→ FAILED
→ RETRYING
→ DISPATCHED
```

---

# STATE DEFINITIONS

---

## PENDING

Meaning:
Fact exists in queue but not selected.

Visible in:

* dashboard
* workspace list

Allowed actions:

* select
* reject

Forbidden:

* dispatch

---

## SELECTED

Meaning:
Operator selected the fact.

System loads:

* previews
* verification evidence
* platform render

Allowed:

* switch platforms
* inspect evidence

---

## REVIEWING

Meaning:
Operator actively reviewing evidence.

Purpose:
encourage validation before editing.

Allowed:

* expand evidence
* inspect source diff
* compare render versions

---

## EDITING

Meaning:
Operator modified generated draft.

Triggers:

```text id="7gydp2"
draftContent !== originalContent
```

UI requirements:

* unsaved changes indicator
* edit warning threshold

---

## READY

Meaning:
Fact is validated and ready for approval.

Conditions:

* preview rendered
* evidence loaded
* platform valid

---

## APPROVING

Meaning:
Approval request in-flight.

UI behavior:

* disable duplicate clicks
* loading spinner
* optimistic lock

---

## DISPATCHING

Meaning:
Dispatcher accepted fact.

UI displays:

* platform progress
* retry state
* response timing

---

## DISPATCHED

Meaning:
Platform acknowledged successful publish.

UI displays:

* success state
* post URL
* timestamp

Fact moves:
workspace → history

---

## FAILED

Meaning:
Dispatch failed.

UI displays:

* error reason
* retry button
* platform status

Failure never silently disappears.

---

## RETRYING

Meaning:
Dispatcher retry cycle active.

Must display:

* retry count
* next retry timing

---

## REJECTED

Meaning:
Operator rejected fact.

Fact removed from active queue.

Audit trail preserved.

---

# STATE TRANSITION RULES

INVALID:

```text id="u0z95i"
PENDING → DISPATCHED
```

VALID:

```text id="2iww93"
PENDING → SELECTED → READY → APPROVING → DISPATCHING
```

---

# UI SAFETY RULES

Workspace must:

* visually distinguish states
* prevent impossible actions
* prevent duplicate approvals

Example:
Approve button disabled during APPROVING.

---

# PLATFORM-SPECIFIC STATES

Future support:

```text id="gwx4zq"
DISPATCHING_LINKEDIN
DISPATCHING_BLUESKY
PARTIAL_SUCCESS
```

Reserved for V2.

---

# OBSERVABILITY INTEGRATION

Every transition emits:

```text id="4bwjlwm"
workspace.state_transition
```

Payload:

```json
{
  "fact_id": "fact_123",
  "from": "READY",
  "to": "APPROVING",
  "timestamp": "..."
}
```

---

# EDIT SAFETY

If operator edits exceed threshold:

```text id="z4pn3v"
verification_confidence = reduced
```

UI warning required.

---

# FUTURE V2 EXTENSIONS

Reserved:

* collaborative review
* multi-approver flow
* scheduled publishing
* semantic grouping
* release-level approval

````

---

# File 7
Path:
```text id="分快三651"
docs/v1.1/PLATFORM_RENDERING_SPEC.md
````

````md id="3a6vdj"
# ProofPost — Platform Rendering Specification
# docs/v1.1/PLATFORM_RENDERING_SPEC.md

---

# PURPOSE

Defines how verified facts transform into platform-specific posts.

Goals:
- preserve factual integrity
- respect platform culture
- avoid robotic cross-posting
- standardize rendering pipeline

One fact should NOT render identically everywhere.

---

# RENDERING PIPELINE

```text
VerifiedBuildFact
→ Platform Formatter
→ Constraint Engine
→ Preview Renderer
→ Dispatch Payload
````

Each stage is deterministic and inspectable.

---

# CORE PRINCIPLE

Verification remains constant.

Presentation changes per platform.

Meaning:

* the verified fact does not change
* wording and formatting may adapt

---

# PLATFORM IDENTITY

---

# BLUESKY

Purpose:
fast engineering updates

Style:

* concise
* technical
* lightweight

Tone:
builder-oriented

Constraints:

* short-form preferred
* avoid long introductions
* avoid corporate tone

Allowed:

* hashtags
* technical shorthand

Avoid:

* excessive emojis
* marketing speak

Example:

```text id="wvfmmu"
Implemented JWT-based auth recovery flow and fixed duplicate dispatch retries.
```

---

# LINKEDIN

Purpose:
professional engineering narrative

Style:

* slightly expanded
* implementation focused
* outcome aware

Structure:

```text id="5t5p5v"
problem
→ implementation
→ operational impact
```

Avoid:

* clickbait founder tone
* hype language

Example:

```text id="mjlwmv"
Implemented a deterministic approval boundary to prevent duplicate dispatches during recovery scenarios.
```

---

# REDDIT (V2)

Purpose:
discussion-oriented explanation

Style:

* conversational
* contextual
* explanatory

Requires:

* subreddit-aware formatting

---

# GITHUB RELEASE NOTES (V2)

Purpose:
technical changelog

Style:

* structured
* bullet-oriented
* implementation precise

---

# RENDERING RULES

Renderers MAY:

* shorten text
* expand context
* alter formatting
* adjust hashtags

Renderers MUST NOT:

* invent unsupported claims
* change technical meaning
* fabricate metrics

---

# CHARACTER MANAGEMENT

If platform limit exceeded:

Priority order:

```text id="0k61xj"
1. remove hashtags
2. shorten intro
3. compress wording
4. thread fallback (future)
```

Never truncate:

* technical meaning
* verification-critical terms

---

# HASHTAG RULES

Bluesky:
light hashtags allowed.

LinkedIn:
minimal hashtags preferred.

Future:
platform-specific hashtag engines.

---

# MEDIA SUPPORT

Reserved for V2:

* screenshots
* diagrams
* code snippets
* generated thumbnails

---

# HUMAN EDIT RULES

Operators MAY:

* refine tone
* improve readability
* shorten text

Operators MUST NOT:

* alter verified meaning
* add unsupported claims

---

# VERIFICATION INTEGRITY

Workspace always displays:

```text id="w24n3j"
verified source
≠ rendered presentation
```

This distinction is critical.

---

# FUTURE RENDERER STRUCTURE

```text
renderers/
  bluesky_renderer.py
  linkedin_renderer.py
  reddit_renderer.py
```

---

# V2 EXTENSIONS

Reserved:

* thread generation
* release narratives
* semantic grouping
* audience adaptation
* scheduling intelligence

````

---

# File 8
Path:
```text id="分快三652"
.agents/workflows/ui-review.md
````

````md id="jlwm0y"
# Workflow: ui-review
# Trigger: /ui-review
# Run after every major frontend phase

---

# MANDATORY CONTEXT LOAD

Read these files:
- docs/governance/constitution.md
- docs/v1.1/UI_ENGINEERING_RULES.md
- docs/v1.1/UI_SPEC.md
- docs/v1.1/UI_STATE_SCHEMA.md

Confirm with:
"Constitution read. UI rules read. UI state read. Ready."

---

# SCOPE

ALLOWED:
- Read any frontend file
- Output findings only

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
````

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

    the gpt output of our files ( 
        This is now legitimately good governance structure. 

You are no longer missing major architectural organization.

Only a few cleanup/finalization tasks remain.

---

# WHAT YOU SHOULD FIX NOW

# 1. PATH INCONSISTENCY

You currently mix:

```text id="分快三674"
docs/ui/
docs/v1.1/
```

Problem:
some concepts overlap.

Decision:

Keep:

```text id="分快三675"
docs/v1.1/
```

for ALL active frontend architecture.

Keep:

```text id="分快三676"
docs/ui/
```

ONLY for:
legacy V1 references.

Add inside:
`SYSTEM_INVENTORY.md`

```text id="分快三677"
docs/ui/ = legacy V1 reference docs
docs/v1.1/ = authoritative active frontend architecture
```

Very important.

---

# 2. ADD MISSING FILES SECTION UPDATE

Your inventory says these are missing:

```text id="分快三678"
docs/V1_COMPLETION_PLAN.md
docs/OPERATOR_TESTING_GUIDE.md
docs/OPERATOR_DEBUG_MODE.md
docs/CANONICAL_STRUCTURE.md
```

But some already exist earlier from your messages.

Meaning:
inventory is outdated.

Fix this section immediately.

---

# 3. ADD NEW DOCS TO INVENTORY

You created:

* UI_STATE_SCHEMA
* WORKSPACE_SPEC
* VIEW_LIFECYCLE
* WORKSPACE_STATE_MACHINE
* UI_COMPONENT_CATALOG
* UI_API_INTEGRATION

But inventory does not mention them yet.

Add them under:

```text id="分快三679"
V1.1 UI/UX Doctrine
```

---

# 4. ADD ONE VERY IMPORTANT SECTION

Add:

```text id="分快三680"
## AUTHORITATIVE SOURCES
```

Example:

| Domain              | Authoritative File         |
| ------------------- | -------------------------- |
| Backend governance  | constitution.md            |
| Frontend governance | UI_ENGINEERING_RULES.md    |
| State architecture  | UI_STATE_SCHEMA.md         |
| Workspace behavior  | WORKSPACE_SPEC.md          |
| Rendering semantics | PLATFORM_RENDERING_SPEC.md |
| Lifecycle rules     | VIEW_LIFECYCLE.md          |

This becomes EXTREMELY useful later.

---

# 5. ADD DOC STATUS TAGS

Right now:
everything looks equally authoritative.

Bad.

Add tags:

```text id="分快三681"
ACTIVE
LEGACY
DRAFT
PLANNED
DEPRECATED
```

Especially for:

* old ui docs
* original build prompts
* transitional workflows

---

# 6. ADD THIS NEW WORKFLOW

You created:

```text id="分快三682"
ui-review.md
```

Good.

Add it to inventory immediately.

---

# 7. VERY IMPORTANT

You now have enough governance that you need:

```text id="分快三683"
docs/CHANGELOG.md
```

Otherwise:
AI assistants will drift on:

* renamed docs
* changed rules
* deprecated workflows

Simple format:

```text id="分快三684"
Date
Added
Changed
Deprecated
```

This becomes critical later.

---

# 8. YOU ARE MISSING ONE FINAL FRONTEND DOC

This is the LAST truly important one.

Create:

```text id="分快三685"
docs/v1.1/ROUTING_SPEC.md
```

Needed because:
you now have:

* lifecycle
* shell
* views
* onboarding
* guards
* transitions

But no authoritative routing rules.

This doc should define:

* routes
* route guards
* protected routes
* onboarding redirects
* fallback routes
* route lifecycle

Then:
frontend architecture becomes fully stabilized.

---

# OVERALL ASSESSMENT

This is now:

```text id="分快三686"
serious engineering governance
```

not:
AI chaos.

And importantly:
your docs are now aligned with:
the actual architecture direction.

That is the critical thing most projects fail at.

    )