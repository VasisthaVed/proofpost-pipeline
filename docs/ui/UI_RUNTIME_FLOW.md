# ProofPost UI Runtime Flow
# docs/ui/UI_RUNTIME_FLOW.md

## STARTUP SEQUENCE

```
1. Page loads
2. Check GET /health
   → if unreachable: show "Backend offline" banner, stop
   → if ok: continue
3. Load dashboard data (GET /health again for stats)
4. Render #view-dashboard
5. Start 15-second polling for pending facts count
```

## NAVIGATION FLOW

```
User clicks nav item
  → hideAllViews()
  → showView(targetView)
  → loadViewData(targetView)
  → render()
```

Each view loads its own data on activation.
No stale data from previous activation.

## APPROVAL FLOW (most critical)

```
User sees pending fact in #view-pending
  → fact shows: type, summary, source_snippet, confidence_score
  → User reads source_snippet to verify manually
  → User clicks Approve or Reject
  → Button shows spinner (disable both buttons)
  → POST /api/facts/{id}/approve or /reject
  → On success: remove fact from pending list, show toast
  → On failure: show error banner, re-enable buttons
  → If 0 facts remain: show "All caught up" state
```

## ERROR FLOW

```
Any API call fails
  → catch error
  → setState({ error: 'Plain English message' })
  → render() shows #error-banner
  → After 5 seconds: setState({ error: null }), render()
```

## SETTINGS SAVE FLOW

```
User edits API key field
  → onChange: mark field as dirty (visual indicator)
  → User clicks Save
  → POST /api/settings with full settings object
  → On success: show "Saved" confirmation, clear dirty state
  → On failure: show error, keep dirty state
```

## PLATFORM TEST FLOW

```
User clicks Test Connection for a platform
  → Button shows spinner
  → POST /api/platforms/{id}/test
  → On success: green dot + "Connected as @handle"
  → On failure: red dot + plain English error + fix link
```

## POLLING LIFECYCLE

```
Enter dashboard or pending view
  → startPolling(15000)
  → every 15s: fetch pending count, update badge in nav

Leave view (navigate away)
  → stopPolling()

Tab becomes hidden (visibilitychange)
  → stopPolling()

Tab becomes visible again
  → startPolling(15000) if on dashboard or pending view
```

## KEYBOARD NAVIGATION

```
Tab / Shift+Tab   → move between interactive elements
Enter / Space     → activate focused button
1                 → go to Dashboard
2                 → go to Pending
3                 → go to History
4                 → go to Platforms
5                 → go to Settings
Escape            → dismiss error banner
```
