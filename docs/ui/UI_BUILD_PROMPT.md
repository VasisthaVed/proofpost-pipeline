# ProofPost UI — Anti-Gravity Build Prompt
# Use this for the UI session

---

## PASTE THIS INTO ANTI-GRAVITY:

```
/build-ui-component

Read first:
- docs/ui/UI_CONSTITUTION.md
- docs/ui/UI_ARCHITECTURE.md
- docs/ui/UI_RUNTIME_FLOW.md
- docs/ui/UI_COMPONENT_SYSTEM.md
- docs/ui/UI_SECURITY_MODEL.md

ALLOWED modifications:
- ui/index.html (create if not exists)

FORBIDDEN:
- Backend modifications
- New dependencies
- External CDN links
- JavaScript frameworks
- Inline onclick handlers
- innerHTML with unescaped API data

Build ui/index.html — the complete ProofPost operator dashboard.

REQUIREMENTS:

1. Single HTML file — CSS and JS embedded
2. Five views: dashboard, pending, history, platforms, settings
3. Dark theme using CSS variables from UI_COMPONENT_SYSTEM.md
4. All API calls go to http://localhost:7821
5. State managed through single global state object
6. All events delegated via data-action attributes
7. Polling every 15 seconds on dashboard and pending views
8. Keyboard shortcuts: 1-5 for views, Escape to dismiss errors

VIEWS TO BUILD:

Dashboard:
- GET /health on load
- Show: backend status, queue depth, AI provider status
- Show: count of pending facts with link to Pending view
- Show: last dispatch timestamp

Pending:
- GET /api/facts/pending on load
- Render each fact as a card showing:
  * fact_type badge
  * summary text
  * source_snippet in monospace block (always visible)
  * confidence_score as percentage
  * Approve + Reject buttons with data-action attributes
- Empty state: "No facts pending approval"
- Approval flow: spinner → API call → remove from list → toast

History:
- GET /api/history on load
- Table showing: date, platform, summary preview, status, url
- Empty state: "No posts dispatched yet"

Platforms:
- GET /api/platforms on load
- Card per platform: name, status dot, last_error, Test button
- Test flow: spinner → POST /api/platforms/{id}/test → update dot

Settings:
- GET /api/settings on load
- Input fields for each platform's credentials
- Password fields for API keys
- Save button → POST /api/settings
- Test connection per platform

SECURITY:
- All API data rendered via textContent or escapeHtml()
- Never innerHTML with raw API data
- CSP meta tag included
- No eval(), no document.write()

After building, verify:
- All 5 views render without errors
- Approve/Reject flow works with mock data
- Error banner shows when backend is unreachable
- Keyboard shortcuts work
- No external network requests
```
