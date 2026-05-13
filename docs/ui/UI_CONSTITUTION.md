# ProofPost UI Constitution
# docs/ui/UI_CONSTITUTION.md

## WHAT THE UI IS

The UI is an operational dashboard for a human operator.
It is not a marketing page. Not a consumer product. Not decorative.

Its job: show pipeline state, enable approval decisions, surface failures.

## WHAT THE UI IS NOT

- Not the source of truth (backend is)
- Not allowed to contain business logic
- Not allowed to make assumptions about data
- Not allowed to cache data beyond one session
- Not allowed to auto-approve anything

## CORE PRINCIPLES

1. Backend is authoritative — UI only displays what the API returns
2. Every action goes to the backend — no frontend-only state changes
3. Failures are visible — never hide errors silently
4. One operator at a time — no multi-user complexity in V1
5. Keyboard navigable — every action reachable without mouse
6. No frameworks — vanilla JS, one HTML file, no build step

## VISUAL PHILOSOPHY

Operational minimalism.
Like a terminal that learned to render HTML.
Dark background. High contrast text. Monospace for data.
Color only for status signals: green=ok, amber=warning, red=error.
No gradients. No animations except functional feedback.
No decorative elements.

## WHAT THE UI RENDERS

Five views only:

1. Dashboard     — system health + pipeline stats
2. Pending       — facts awaiting human approval
3. History       — dispatched posts log
4. Platforms     — connection status per platform
5. Settings      — API keys and configuration

No other views in V1.

## NON-NEGOTIABLE RULES

1. Every API call shows a loading state
2. Every API error shows a plain English message
3. No action is irreversible without confirmation
4. Approve and Reject buttons are never disabled silently
5. If backend is unreachable — show "Backend offline" prominently
6. No inline styles — CSS classes only
7. No external CDN dependencies — fully offline capable
8. Monospace font for all data display
9. Sans-serif font for all UI chrome
10. Zero JavaScript frameworks — vanilla only
