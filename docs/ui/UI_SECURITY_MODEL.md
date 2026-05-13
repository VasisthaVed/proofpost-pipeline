# ProofPost UI Security Model
# docs/ui/UI_SECURITY_MODEL.md

## THREAT MODEL

The UI is a local operator dashboard.
It runs on localhost. Single user. No authentication in V1.
Primary threats are not external attackers — they are:

1. XSS via rendered fact content (from GitHub webhook payload)
2. Accidental credential exposure in the browser
3. UI state desync causing wrong approval decisions

## XSS PREVENTION

All content from the API must be escaped before rendering.
Never use innerHTML with API data directly.

```javascript
// FORBIDDEN
element.innerHTML = fact.summary

// REQUIRED
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
element.textContent = fact.summary
// OR
element.innerHTML = escapeHtml(fact.summary)
```

The source_snippet field is especially dangerous.
It contains raw text from GitHub commits.
Always render as textContent or escaped HTML. Never raw.

## CREDENTIAL HANDLING

API keys entered in Settings are:
- Sent to backend via POST /api/settings
- Never stored in localStorage
- Never stored in sessionStorage
- Never logged to console
- Displayed as password fields (type="password")
- Show/hide toggle is acceptable

After saving, the UI does not retain the key value.
Next load of Settings fetches masked values from backend.

## STATE CONSISTENCY

Before rendering approve/reject buttons:
- Verify the fact ID matches what was loaded
- Verify the fact status is still 'pending'
- If status changed (another session approved it): refresh and show updated state

After approve/reject action:
- Remove fact from local state immediately
- Do not wait for next poll to update UI
- If API call fails: restore fact to local state

## CONTENT SECURITY POLICY

Add to ui/index.html:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self' http://localhost:7821;
           script-src 'self' 'unsafe-inline';
           style-src 'self' 'unsafe-inline';
           connect-src http://localhost:7821;">
```

This prevents the UI from making requests to any external server.
All API calls go to localhost:7821 only.

## ERROR MESSAGE SAFETY

Error messages shown to operator may contain API responses.
These must also be escaped before display.
Never render raw error.message from fetch() directly as HTML.

## NO EVAL, NO DYNAMIC SCRIPT

```javascript
// FORBIDDEN
eval(anything)
new Function(anything)
document.write(anything)
setTimeout('string', delay)  // string form only — function form ok
```
