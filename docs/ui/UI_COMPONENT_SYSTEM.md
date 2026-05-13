# ProofPost UI Component System
# docs/ui/UI_COMPONENT_SYSTEM.md

## COMPONENT CATALOGUE

Every UI element is a pure function returning HTML string.
No classes. No instances. No state inside components.

---

### statusDot(status)
Renders a colored status indicator.
```
status: 'ok' | 'warning' | 'error' | 'offline' | 'unknown'
returns: <span class="dot dot--{status}"></span>
```

---

### factCard(fact)
Renders one VerifiedBuildFact awaiting approval.
```
Shows:
- fact.fact_type (badge)
- fact.summary (main text)
- fact.source_snippet (monospace block — this is the proof)
- fact.confidence_score (as percentage)
- fact.created_at (relative time)
- Approve button [data-action="approve" data-id="{fact.id}"]
- Reject button  [data-action="reject"  data-id="{fact.id}"]

Rules:
- source_snippet always visible — never collapsible
- Both buttons disabled during API call
- Confidence below 0.8 shows amber warning
```

---

### historyRow(result)
Renders one dispatched post in history table.
```
Shows:
- result.created_at
- result.platform (with icon)
- result.summary preview (truncated at 80 chars)
- result.status badge (success / failed / retried)
- result.url as link if available
```

---

### platformCard(platform)
Renders one platform connection status.
```
Shows:
- platform.name + emoji
- statusDot based on platform.connected
- platform.last_error if present (red text)
- Test Connection button [data-action="test-platform" data-id="{platform.id}"]
- last_tested timestamp
```

---

### healthBar(health)
Renders system health summary on dashboard.
```
Shows:
- Backend status dot
- Database connection status
- Queue depth (pending / dispatching / failed)
- AI provider status
- Last successful dispatch timestamp
```

---

### errorBanner(message)
Renders error notification.
```
Shows:
- Error icon
- message text (plain English only — no stack traces)
- Dismiss button [data-action="dismiss-error"]
- Auto-dismiss after 5 seconds
```

---

### emptyState(message)
Renders when a view has no data.
```
Shows:
- Simple icon
- message text
Examples:
- "No facts pending approval"
- "No posts dispatched yet"
- "No platforms connected"
```

---

### loadingSpinner()
Renders inline loading indicator.
```
Used inside buttons during API calls.
Used as full-view overlay during initial data load.
CSS animation only — no JS required.
```

---

### toast(message, type)
Renders temporary success notification.
```
type: 'success' | 'info'
Auto-dismisses after 3 seconds.
Positioned bottom-right.
Does not block interaction.
```

---

## CSS CLASS CONVENTIONS

```
.dot            base status dot
.dot--ok        green
.dot--warning   amber
.dot--error     red
.dot--offline   grey
.dot--unknown   grey dashed

.badge          inline label
.badge--type    fact type label
.badge--status  dispatch status label

.card           container with border
.card--fact     fact approval card
.card--platform platform status card

.btn            base button
.btn--approve   green approve button
.btn--reject    red reject button
.btn--secondary grey secondary action
.btn--loading   disabled + spinner state

.view           full page view container
.view--active   currently visible view

.mono           monospace text (data display)
.muted          secondary text color
.error-text     red error text
```

## COLOR TOKENS (CSS variables)

```css
:root {
  --bg:        #0A0A0F;
  --surface:   #111118;
  --border:    #1E1E2E;
  --text:      #E2E8F0;
  --text-muted:#64748B;
  --green:     #10B981;
  --amber:     #F59E0B;
  --red:       #EF4444;
  --blue:      #3B82F6;
  --mono:      'JetBrains Mono', 'Fira Code', monospace;
  --sans:      'Inter', system-ui, sans-serif;
}
```
