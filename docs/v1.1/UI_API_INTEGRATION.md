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
```

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

All frontend error handling must use the canonical error structure:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "target": "optional.field.path"
  }
}
```
No raw string errors allowed.

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
