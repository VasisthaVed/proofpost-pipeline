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
```

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
+(container, state)
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
