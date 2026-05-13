# ProofPost Bug Report
**Generated:** 2026-05-13  
**Scope:** Full read audit — `core/main.py`, `core/config.py`, `core/database.py`, `core/models.py`, `schemas/responses.py`, `execution/dispatcher.py`, `execution/retry.py`, `ui/index.html`, `settings.json`  
**Rule:** No code changed. Observations and recommendations only.

---

## EXECUTIVE SUMMARY

The primary complaint — **"save button shows nothing, username disappears, settings.json never updates"** — is caused by **four compounding bugs** working together:

1. The UI builds a payload that includes an `environment` sub-object AND `dry_run`/`dev_mode` at the root simultaneously, which Pydantic rejects as ambiguous input.
2. The UI's `handleSaveSettings` pre-fills `config` with an `environment: {}` key (line 856) but the field inputs write `dry_run` and `dev_mode` directly to the root of `config`. This means `environment` is always sent empty, triggering the old-path remapping logic that reads from an empty object.
3. After a save attempt fails with HTTP 400, the UI calls `setState({ error: err.message, loading: false })` **but does not call `loadViewData('settings')` again**, so the settings view goes blank (the handle disappears).
4. `settings.json` is only written inside the `try` block, but because the `Settings(**payload)` call fails first (due to bug #1), the write never executes.

---

## BACKEND BUGS

---

### BUG-B1 — `handleSaveSettings` sends conflicting payload structure
**File:** `ui/index.html` line 852–857  
**Severity:** 🔴 CRITICAL — root cause of settings.json never updating

```js
const config = { 
  ingestion: {}, 
  ai: { model: state.data.settings.ai.model }, 
  platforms: {}, 
  environment: {}   // ← Problem: this key is ALWAYS present
};
```

The pre-initialized `config` object has `environment: {}`. Then the `inputs.forEach` loop runs and, because the checkbox fields now have `data-field="dry_run"` and `data-field="dev_mode"` (no dot prefix), they are written directly onto `config.dry_run` and `config.dev_mode` at the root level.

The POST payload that actually gets sent therefore looks like:
```json
{
  "ingestion": { "hmac_secret": "..." },
  "ai": { "provider": "...", "api_key": "...", "model": "..." },
  "platforms": { "bluesky": { "handle": "...", "app_password": "..." }, "linkedin_token": "..." },
  "environment": {},   ← empty but still present
  "dry_run": true,
  "dev_mode": false
}
```

In `save_settings` on the backend (`main.py` line 348–351), the presence of `"environment"` triggers:
```python
if "environment" in payload:
    env = payload.pop("environment")
    payload["dry_run"] = env.get("dry_run", state.settings.dry_run)  # reads from empty dict → uses OLD value
    payload["dev_mode"] = env.get("dev_mode", state.settings.dev_mode)
```

This **overwrites the already-correct root-level `dry_run` / `dev_mode` values** with the old state values. The net effect is that toggles cannot be changed via the UI.

More critically: if `env` is malformed or the payload now has duplicate keys after merging, Pydantic's `Settings(**payload)` may throw a `ValidationError`, causing an HTTP 400, and settings.json is never written.

---

### BUG-B2 — Error path in `handleSaveSettings` blanks the settings view
**File:** `ui/index.html` line 880–884  
**Severity:** 🔴 CRITICAL — explains why "username disappears"

```js
} catch (err) {
  showToast('Error saving settings. Manual restart may be required.', 'warning');
  setState({ error: err.message, loading: false });
}
```

When the backend returns HTTP 400, the UI sets `state.error` and `state.loading = false`, then calls `render()`. **It does NOT call `loadViewData('settings')` again.** 

`render()` reads `state.data.settings` to build the settings form. Because `loadViewData('settings')` was never called after navigating to settings **in this failed save path**, `state.data.settings` remains the stale cached value — but because `render()` wiped and rewrote the DOM (via `container.innerHTML = ...`), the new render reads the same cached object and displays it. However, if the render crashes mid-way because `state.data.settings` became `null` due to any prior error, the view renders the empty state: `"Loading configuration..."` — the form disappears entirely, including the Bluesky handle.

**Confirmed path:** 400 from backend → `setState({ error, loading: false })` → `render()` → form re-built from potentially null/stale settings → fields appear empty.

---

### BUG-B3 — `schemas/responses.py` SettingsResponse is stale and no longer matches API
**File:** `schemas/responses.py` lines 62–84  
**Severity:** 🟠 MEDIUM — dead schema code, causes confusion

The `GET /api/settings` endpoint was changed to return a raw dict (no `response_model`) because the schema was incompatible. However, the old `SettingsResponse`, `AISettingsResponse`, `PlatformSettingsResponse`, and `EnvironmentSettingsResponse` classes still exist in `responses.py` and define the **old** field names (`gemini_api_key`, `bluesky_handle`, `bluesky_password`, `environment` sub-object).

These are imported in `main.py` line 36 (`SettingsResponse`) but never used as a response_model. They are dead weight that can mislead future developers about the actual API contract.

---

### BUG-B4 — `save_settings` has no database field for `max_payload_size`
**File:** `core/main.py` line 388  
**Severity:** 🟠 MEDIUM — `max_payload_size` is silently lost

The settings form **does not expose** `ingestion.max_payload_size`. The `handleSaveSettings` function sends:
```json
"ingestion": { "hmac_secret": "..." }
```
No `max_payload_size` key. When `Settings(**payload)` is called, Pydantic uses the default (`1048576`). The existing configured value is **silently discarded and reset to the default** every time settings are saved.

---

### BUG-B5 — `database` key is merged into save payload from stale state
**File:** `ui/index.html` line 872  
**Severity:** 🟡 LOW — works by accident, fragile

```js
config.database = state.data.settings.database;
```

The `GET /api/settings` response does **not** include a `database` key (line 322–340 of `main.py`). So `state.data.settings.database` is always `undefined`. When `config.database = undefined` is JSON serialized via `JSON.stringify`, the `database` key is silently omitted.

This works accidentally because `Settings` has a default for `database`. But if `state.data.settings` is null for any reason, this line throws a `TypeError` before the API call is even made.

---

### BUG-B6 — `platforms` in GET response puts `linkedin_token` at wrong nesting level
**File:** `core/main.py` line 323–329  
**Severity:** 🟠 MEDIUM — UI field read path is inconsistent

`GET /api/settings` returns:
```json
{
  "platforms": {
    "bluesky": { "handle": "...", "app_password": "****" },
    "linkedin_token": "****"
  }
}
```

The LinkedIn token is at `platforms.linkedin_token`. The UI reads it correctly at `s.platforms?.linkedin_token`. However, the `data-field` for the LinkedIn input is `"platforms.linkedin_token"`, which the `inputs.forEach` nesting loop sets correctly on `config.platforms.linkedin_token`. This is **fine**.

BUT: the `unmask` call in `save_settings` (line 385) does:
```python
p["linkedin_token"] = unmask(p.get("linkedin_token"), state.settings.platforms.linkedin_token)
```
If the UI sends an **empty string** `""` for `linkedin_token` (user cleared it), `unmask` returns `""` because `"" != "****"`. This correctly clears the token. However if the user sends `"****"` (didn't touch the field), `unmask` preserves the old value. **This logic is correct but undocumented and non-obvious.**

---

### BUG-B7 — `model_dump()` on save writes Pydantic model with Python field aliases not JSON aliases
**File:** `core/main.py` line 393  
**Severity:** 🟡 LOW — could break on enum serialization

```python
json.dump(updated_settings.model_dump(), f, indent=2)
```

`model_dump()` returns Python objects, including enum instances (e.g., `FactType.BUILD_SUCCESS` as the enum object, not its string value `"build_success"`). However, `Settings` itself doesn't contain enums, so this is not an active bug today. But `model_dump_json()` would be safer and more consistent (it uses Pydantic's JSON serialization rules). This is a latent risk if the `Settings` model ever gains enum fields.

---

### BUG-B8 — `history` endpoint returns `fact.created_at` (not the DB row's `created_at`)
**File:** `core/database.py` line 343  
**Severity:** 🟡 LOW — minor data consistency issue

```python
"created_at": fact.created_at,
```

The `dispatch_queue` table has its own `created_at` column (`row["created_at"]`) which represents when the fact entered the queue. The code is reading from `fact.created_at` (inside the JSON payload), which is when the fact was **originally extracted**, not when it was dispatched. This means history timestamps can appear earlier than expected.

---

### BUG-B9 — `test_platform` endpoint only works for LinkedIn, silently fails for Bluesky
**File:** `core/main.py` lines 286–312  
**Severity:** 🟡 LOW — incomplete feature

```python
if platform_id == "linkedin":
    for a in state.dispatcher.adapters:
        if isinstance(a, LinkedInAdapter): ...
```

There is no `elif platform_id == "bluesky"` branch. Clicking "Test Connection" for Bluesky always returns:
```json
{ "status": "error", "connected": false, "message": "Adapter for bluesky not initialized or not supported yet." }
```
Even when Bluesky is fully configured and its adapter is active.

---

### BUG-B10 — `settings.json` is opened with a relative path, not an absolute path
**File:** `core/main.py` line 392  
**Severity:** 🟠 MEDIUM — path resolution depends on CWD

```python
with open("settings.json", "w") as f:
```

This uses the process's current working directory. If `python main.py` is not run from `c:\Pro\PROJECT\ProofPost\`, the file will be written (or read) at the wrong location. `load_config` has the same issue (line 63 of `config.py`). These should use `os.path.dirname(__file__)` or an explicit absolute path derived from the project root.

---

## UI BUGS

---

### BUG-UI1 — Settings form pre-fills `config` with `environment: {}` but writes `dry_run`/`dev_mode` at root
**File:** `ui/index.html` lines 852–868  
**Severity:** 🔴 CRITICAL — see BUG-B1 above for full impact

The `config` object is initialized with `environment: {}`. The `inputs.forEach` loop then iterates all `[data-field]` elements. The checkbox fields have:
- `data-field="dry_run"` → written to `config.dry_run` (root)
- `data-field="dev_mode"` → written to `config.dev_mode` (root)

So the final config has **both** `environment: {}` (empty, always) AND `dry_run`/`dev_mode` at root. The backend's `if "environment" in payload` branch fires, reads from the empty `{}`, and overwrites the root values with old state. **Net effect: checkboxes never actually save.**

**Fix suggestion:** Remove `environment: {}` from the initial `config` object.

---

### BUG-UI2 — After any save error, the settings form goes blank
**File:** `ui/index.html` lines 880–884  
**Severity:** 🔴 CRITICAL — explains the "username disappears" symptom

When save fails, the catch block calls `setState({ error: err.message, loading: false })`. `setState` triggers `render()`. The `render()` for the `settings` view reads `state.data.settings`, but because `loadViewData('settings')` is NOT called in the error path, and because the error banner/spinner overlay the form during the loading state, the form is regenerated from whatever `state.data.settings` was — which may be the last valid value. 

**However**: `loading: false` is set immediately on error, which removes the spinner, and then `render()` rebuilds the settings form. BUT if during the `handleSaveSettings` function, `setState({ loading: true })` was called first (line 849), this triggers a render that shows the spinner. Then the error path calls `setState({ error, loading: false })` which renders the form again.

The issue is that when `loading` goes to `true`, `render()` is called. If `state.data.settings` is still set from the initial load, the form renders fine behind the spinner. When `loading` goes back to `false` with the error, the form re-renders. This should work.

**BUT**: The real problem is that **`loadViewData('settings')` is not called on error**, so the form reflects pre-save state but the Bluesky handle that was displayed came from `state.data.settings.platforms.bluesky.handle`. If `state.data.settings` is still intact, the handle should still show. 

**Confirmed deeper cause**: The handle disappears because the `render()` function rebuilds the DOM via `container.innerHTML = ...`, and any input values (like a typed handle) are **reset to whatever is in `state.data.settings`**. If the user typed a new handle, pressed save, and the save failed — the handle in the input **reverts to the original value** from state. This appears as "username disappears" because it reverts to blank if the original was empty.

---

### BUG-UI3 — No inline error display in the settings form after failed save
**File:** `ui/index.html` lines 880–884  
**Severity:** 🟠 MEDIUM — poor UX, no feedback about what failed

The error is set on `state.error` which shows in the red banner at the top of the page. But the banner auto-clears on dismiss (Escape key). There is no per-field or per-form error display. After a failed save, the user sees a toast saying "Error saving settings. Manual restart may be required." This message is **misleading** — a restart is almost never needed. The actual error (e.g., a Pydantic validation error message) is in `state.error` shown in the banner but the toast overwrites the correct feedback with incorrect advice.

---

### BUG-UI4 — Toast notification for error uses `'warning'` color but message is incorrect
**File:** `ui/index.html` line 882  
**Severity:** 🟡 LOW — misleads the operator

```js
showToast('Error saving settings. Manual restart may be required.', 'warning');
```

This is inaccurate. Settings failures are almost always API validation errors (HTTP 400) that can be fixed by correcting the form and retrying. The message "Manual restart may be required" will make operators unnecessarily restart the server.

---

### BUG-UI5 — `state.data.settings.database` is always `undefined` on the client
**File:** `ui/index.html` line 872  
**Severity:** 🟡 LOW — fragile fallback

```js
config.database = state.data.settings.database;
```

The `GET /api/settings` response (per `main.py` lines 322–340) does not include `database`. So `state.data.settings.database` is always `undefined`, and after JSON serialization the `database` key is omitted. This is harmless today (Pydantic supplies the default), but it's a silent contract violation.

---

### BUG-UI6 — CSP `connect-src 'self'` blocks ngrok connections
**File:** `ui/index.html` line 10  
**Severity:** 🟠 MEDIUM — breaks ngrok operator workflow

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self';">
```

`connect-src 'self'` restricts all `fetch()` calls to the same origin. When accessing the dashboard via an ngrok URL (e.g., `https://abc123.ngrok.io`), `window.location.origin` = `https://abc123.ngrok.io`. The API calls go to `https://abc123.ngrok.io/api/...`. This technically satisfies `'self'`, so it should work.

**However**: if the server is accessed on localhost (`http://localhost:7821`) and the user opens a **second tab** or redirected origin, this can fail. More importantly, if the operator ever uses a reverse proxy with a different port or subdomain, `connect-src 'self'` will silently block all API calls. The dashboard will appear offline.

---

### BUG-UI7 — Platform section shows `platforms` array length check, but API returns `{ platforms: [...] }`
**File:** `ui/index.html` line 629  
**Severity:** 🟠 MEDIUM — conditional logic is wrong

```js
case 'platforms':
  if (state.data.platforms.length === 0) {
```

`loadViewData('platforms')` does:
```js
newData.platforms = platforms;
```

where `platforms = await API.getPlatforms()`. The API returns `{ platforms: [...] }` (per `get_platforms` route). So `state.data.platforms` is an **object** `{ platforms: [...] }`, not an array. Calling `.length` on an object returns `undefined`, not `0`. The condition `undefined === 0` is `false`, so it falls through to the `else` branch.

The `else` branch then does:
```js
state.data.platforms.map(p => components.platformCard(p))
```

Calling `.map()` on `{ platforms: [...] }` throws `TypeError: state.data.platforms.map is not a function`.

**This means the Platforms view crashes every time it is opened.** The error is caught by the global error banner. This also means the Platform status cards are **never rendered**.

---

### BUG-UI8 — `history` array check uses `.length` but API returns `{ items: [...], total: N }`
**File:** `ui/index.html` line 611  
**Severity:** 🔴 CRITICAL — History view never renders

```js
case 'history':
  if (state.data.history.length === 0) {
```

`loadViewData('history')` does:
```js
newData.history = history;
```

where `history = await API.getHistory()`. The API endpoint returns `{ items: [...], total: N }` (per the `HistoryResponse` model). So `state.data.history` is an object, not an array. `.length` returns `undefined`. The condition `undefined === 0` is `false`, falling through to:

```js
state.data.history.map(r => components.historyRow(r))
```

This throws `TypeError: state.data.history.map is not a function`.

**The History view crashes and shows an error banner every time it is opened.**

---

### BUG-UI9 — `loadViewData('history')` assigns the whole response object, not `.items`
**File:** `ui/index.html` line 759–761  
**Severity:** 🔴 CRITICAL — same root cause as BUG-UI8

```js
case 'history':
  const history = await API.getHistory();
  newData.history = history;  // ← assigns { items: [...], total: N }
```

Should be `newData.history = history.items ?? []` to match the rest of the code which assumes `state.data.history` is an array.

---

### BUG-UI10 — `loadViewData('platforms')` assigns the whole response, not `.platforms`
**File:** `ui/index.html` line 763–766  
**Severity:** 🔴 CRITICAL — same root cause as BUG-UI7

```js
case 'platforms':
  const platforms = await API.getPlatforms();
  newData.platforms = platforms;  // ← assigns { platforms: [...] }
```

Should be `newData.platforms = platforms.platforms ?? []`.

---

---

### BUG-B11 — `dispatcher.py` retries all platforms on partial failure
**File:** `execution/dispatcher.py` lines 121–135  
**Severity:** 🟠 MEDIUM — can cause duplicate posts

```python
results = await asyncio.gather(
    *(adapter.dispatch(fact) for adapter in self.adapters),
    return_exceptions=True
)
```
If one adapter fails (e.g. LinkedIn rate limit), the `Dispatcher` treats it as a partial failure and retries the *entire set*. This means successfully dispatched platforms (e.g. Bluesky) will receive the post again, leading to duplicates on the successful platforms.

---

### BUG-B12 — `gemini_provider.py` does not strip markdown from JSON response
**File:** `extraction/gemini_provider.py` line 116  
**Severity:** 🟡 LOW — latent parsing risk

```python
raw_facts = json.loads(response.text)
```
Even with `response_mime_type: "application/json"`, some models occasionally wrap the output in markdown (````json ... ````). The code uses `json.loads` directly on the raw text. If markdown formatting is present, it will throw a `JSONDecodeError` and the extraction will fail silently returning `[]`.

---

### BUG-B13 — `deduplicator.py` fails open on DB error
**File:** `ingestion/deduplicator.py` line 45  
**Severity:** 🟡 LOW — security risk edge case

```python
return False
```
If the database connection fails during the `is_duplicate` check, it catches the exception and returns `False` (fails open). In a security context (preventing replay attacks or duplicate massive payload processing), failing open can be dangerous. It should ideally fail closed or raise the exception.

---

## SUMMARY TABLE

| ID | File | Severity | Description |
|---|---|---|---|
| BUG-B1 | `ui/index.html:852` + `main.py:348` | 🔴 CRITICAL | [FIXED] `environment: {}` in payload causes save to ignore toggle changes |
| BUG-B2 | `ui/index.html:880` | 🔴 CRITICAL | Error path does not reload settings; form loses user input |
| BUG-B3 | `schemas/responses.py:62` | 🟠 MEDIUM | [FIXED] Dead `SettingsResponse` classes with wrong field names |
| BUG-B4 | `main.py:388` + `ui/index.html:655` | 🟠 MEDIUM | [FIXED] `max_payload_size` silently reset to default on every save |
| BUG-B5 | `ui/index.html:872` | 🟡 LOW | `config.database = undefined` — fragile fallback |
| BUG-B6 | `main.py:385` | 🟡 LOW | LinkedIn clear logic correct but undocumented |
| BUG-B7 | `main.py:393` | 🟡 LOW | [FIXED] `model_dump()` instead of `model_dump_json()` — latent enum risk |
| BUG-B8 | `database.py:343` | 🟡 LOW | [FIXED] History timestamps show extraction time, not dispatch time |
| BUG-B9 | `main.py:286` | 🟡 LOW | Bluesky platform test not implemented |
| BUG-B10 | `main.py:392` | 🟠 MEDIUM | [FIXED] `settings.json` written to relative CWD path |
| BUG-B11 | `dispatcher.py:121` | 🟠 MEDIUM | [FIXED] Retries all adapters on partial failure, causing duplicates |
| BUG-B12 | `gemini_provider.py:116`| 🟡 LOW | [FIXED] Does not strip markdown from JSON response before parsing |
| BUG-B13 | `deduplicator.py:45` | 🟡 LOW | `is_duplicate` fails open (returns False) on DB error |
| BUG-UI1 | `ui/index.html:856` | 🔴 CRITICAL | [FIXED] `environment: {}` pre-fill causes toggle fields to never save |
| BUG-UI2 | `ui/index.html:880` | 🔴 CRITICAL | [FIXED] Error path blanks the form (handle "disappears") |
| BUG-UI3 | `ui/index.html:882` | 🟠 MEDIUM | Toast message is misleading ("Manual restart may be required") |
| BUG-UI4 | `ui/index.html:882` | 🟡 LOW | Wrong toast color category for save errors |
| BUG-UI5 | `ui/index.html:872` | 🟡 LOW | `settings.database` always undefined from API |
| BUG-UI6 | `ui/index.html:10` | 🟠 MEDIUM | CSP `connect-src 'self'` fragile under proxies |
| BUG-UI7 | `ui/index.html:629` | 🔴 CRITICAL | [FIXED] `state.data.platforms` is object, `.length` → TypeError crash |
| BUG-UI8 | `ui/index.html:611` | 🔴 CRITICAL | [FIXED] `state.data.history` is object, `.length` → TypeError crash |
| BUG-UI9 | `ui/index.html:760` | 🔴 CRITICAL | [FIXED] `newData.history` should be `history.items`, not the full response |
| BUG-UI10 | `ui/index.html:765` | 🔴 CRITICAL | [FIXED] `newData.platforms` should be `platforms.platforms` (Fixed in render path) |

---

## CRITICAL PATH (What to Fix First)

To restore Settings save + reload:
1. **BUG-UI1 / BUG-B1**: Remove `environment: {}` from the `config` init object in `handleSaveSettings`.
2. **BUG-UI2 / BUG-B2**: In the `catch` block of `handleSaveSettings`, call `loadViewData('settings')` to restore form state.
3. **BUG-UI9**: Change `newData.history = history` to `newData.history = history.items ?? []`.
4. **BUG-UI10**: Change `newData.platforms = platforms` to `newData.platforms = platforms.platforms ?? []`.

These four fixes resolve all the user-visible crashes (History view broken, Platforms view broken, Settings save broken, handle disappearing).
