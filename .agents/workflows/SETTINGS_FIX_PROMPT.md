# ProofPost — Settings End-to-End Fix
# Paste this entire prompt into Anti-Gravity

/fix-bug

You are fixing the ProofPost settings system completely.
The settings page must work end to end for a non-technical user.
No workarounds. No "edit the JSON manually". It must just work.

---

## MANDATORY CONTEXT LOAD

Read ALL of these files before touching anything:

1. core/config.py — the Python Settings model (source of truth)
2. settings.json — the actual config file on disk
3. schemas/responses.py — SettingsResponse schema
4. core/main.py — GET /api/settings and POST /api/settings routes
5. ui/index.html — settings view render function AND save function

After reading all 5 files, write out:

A) Exact JSON that GET /api/settings currently returns
B) Exact JSON that ui/index.html currently sends to POST /api/settings
C) Every field mismatch between A and B
D) Every field mismatch between settings.json and core/config.py

Do not write a single line of code until you have completed A, B, C, D.
Show your work. I need to see the analysis before the fix.

---

## ALLOWED MODIFICATIONS

- core/config.py
- core/main.py
- schemas/responses.py
- ui/index.html
- settings.json (only to fix structure, not to add real credentials)

## FORBIDDEN

- core/models.py
- core/database.py
- execution/*
- ingestion/*
- extraction/*
- verification/*
- platforms/*
- tests/* (unless a test is directly broken by your fix)

---

## THE CANONICAL SETTINGS STRUCTURE

This is the ONE structure everything must use.
Backend, frontend, and settings.json must all agree on this exact shape:

```json
{
  "database": {
    "url": "proofpost.db"
  },
  "ingestion": {
    "hmac_secret": "proofpost-dev-secret-2026",
    "max_payload_size": 1048576
  },
  "ai": {
    "provider": "gemini",
    "api_key": "",
    "model": "gemini-2.0-flash-exp"
  },
  "platforms": {
    "bluesky": {
      "enabled": true,
      "handle": "",
      "app_password": ""
    },
    "linkedin": {
      "enabled": false,
      "access_token": ""
    }
  },
  "dev_mode": false,
  "dry_run": false
}
```

No other structure is acceptable.
No flat fields like bluesky_handle at the root of platforms.
No environment key anywhere.
No telegram, reddit, or other platforms in V1.

---

## WHAT YOU MUST FIX

### Fix 1 — core/config.py

The Pydantic Settings model must exactly match the canonical structure.

BlueskySettings:
  enabled: bool = True
  handle: str = ""
  app_password: str = ""

LinkedInSettings:
  enabled: bool = False
  access_token: str = ""

PlatformSettings:
  bluesky: BlueskySettings = BlueskySettings()
  linkedin: LinkedInSettings = LinkedInSettings()

AISettings:
  provider: str = "mock"
  api_key: str = ""
  model: str = "gemini-2.0-flash-exp"

IngestionSettings:
  hmac_secret: str = "proofpost-dev-secret-2026"
  max_payload_size: int = 1048576

DatabaseSettings:
  url: str = "proofpost.db"

Settings:
  database: DatabaseSettings = DatabaseSettings()
  ingestion: IngestionSettings = IngestionSettings()
  ai: AISettings = AISettings()
  platforms: PlatformSettings = PlatformSettings()
  dev_mode: bool = False
  dry_run: bool = False

---

### Fix 2 — GET /api/settings in core/main.py

Must return EXACTLY this shape (mask secrets):

```json
{
  "ingestion": {
    "hmac_secret": "****",
    "max_payload_size": 1048576
  },
  "ai": {
    "provider": "gemini",
    "api_key": "****",
    "model": "gemini-2.0-flash-exp"
  },
  "platforms": {
    "bluesky": {
      "enabled": true,
      "handle": "dacorvo.bsky.social",
      "app_password": "****"
    },
    "linkedin": {
      "enabled": false,
      "access_token": "****"
    }
  },
  "dev_mode": false,
  "dry_run": false
}
```

Rules for masking:
- If a secret field is non-empty: return "****"
- If a secret field is empty: return ""
- Handle and provider are NOT masked — return real values
- max_payload_size is NOT masked — return real value
- dev_mode and dry_run are NOT masked — return real bool values

---

### Fix 3 — POST /api/settings in core/main.py

Must accept this exact shape from the frontend:

```json
{
  "ingestion": {
    "hmac_secret": "new-secret-or-empty-string"
  },
  "ai": {
    "provider": "gemini",
    "api_key": "new-key-or-empty-string",
    "model": "gemini-2.0-flash-exp"
  },
  "platforms": {
    "bluesky": {
      "enabled": true,
      "handle": "dacorvo.bsky.social",
      "app_password": "new-password-or-empty-string"
    },
    "linkedin": {
      "enabled": false,
      "access_token": ""
    }
  },
  "dev_mode": false,
  "dry_run": true
}
```

Critical rules for save logic:
1. If a secret field value is "****": DO NOT overwrite the existing value
   Keep whatever is already in settings.json
2. If a secret field value is "" (empty): clear it
3. If a secret field value is anything else: save the new value
4. max_payload_size: always preserve existing value unless explicitly sent
5. After saving: reload state.settings from the updated file
6. After saving: re-initialize platform adapters with new credentials
7. Return: {"status": "saved", "reloaded": true}

---

### Fix 4 — schemas/responses.py

Delete all dead SettingsResponse classes.
Create ONE correct SettingsResponse that matches GET /api/settings output exactly.
Use Optional[str] for masked fields.

---

### Fix 5 — ui/index.html settings view

#### Load function (called when user opens Settings tab):

```javascript
async function loadSettings() {
  const data = await API.getSettings()  // GET /api/settings
  
  // Populate every field from response
  document.getElementById('bluesky-handle').value = 
    data.platforms?.bluesky?.handle || ''
  
  document.getElementById('bluesky-password').value = 
    data.platforms?.bluesky?.app_password || ''
  // Shows '****' if set, '' if empty — do not replace with placeholder
  
  document.getElementById('gemini-key').value = 
    data.ai?.api_key || ''
  
  document.getElementById('ai-provider').value = 
    data.ai?.provider || 'mock'
  
  document.getElementById('ai-model').value = 
    data.ai?.model || ''
  
  document.getElementById('hmac-secret').value = 
    data.ingestion?.hmac_secret || ''
  
  document.getElementById('dev-mode-toggle').checked = 
    data.dev_mode || false
  
  document.getElementById('dry-run-toggle').checked = 
    data.dry_run || false
}
```

Make sure every input field has the correct id attribute matching above.
If any id is different in the current HTML: fix the id to match.

#### Save function:

```javascript
async function saveSettings() {
  const payload = {
    ingestion: {
      hmac_secret: document.getElementById('hmac-secret').value
    },
    ai: {
      provider: document.getElementById('ai-provider').value,
      api_key: document.getElementById('gemini-key').value,
      model: document.getElementById('ai-model').value
    },
    platforms: {
      bluesky: {
        enabled: true,
        handle: document.getElementById('bluesky-handle').value,
        app_password: document.getElementById('bluesky-password').value
      },
      linkedin: {
        enabled: false,
        access_token: ''
      }
    },
    dev_mode: document.getElementById('dev-mode-toggle').checked,
    dry_run: document.getElementById('dry-run-toggle').checked
  }
  
  // No environment key. No database key. Nothing else.
  
  try {
    const result = await API.postSettings(payload)
    showToast('Settings saved successfully', 'success')
    await loadSettings()  // Reload to show masked values
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error')
    await loadSettings()  // Reload to restore form state
  }
}
```

---

## DEFINITION OF DONE

Do not mark this complete until ALL of these pass:

- [ ] Open Settings page — all fields show current values from settings.json
- [ ] Bluesky handle field shows the real handle (not empty, not undefined)
- [ ] Secret fields show **** if set, empty if not set
- [ ] dev_mode toggle matches current settings.json value
- [ ] dry_run toggle matches current settings.json value
- [ ] Type a new Bluesky handle — click Save — no 400 error
- [ ] Check settings.json — new handle is written correctly
- [ ] Refresh the page — handle still shows (not blank)
- [ ] Type **** in a secret field — save — original secret preserved
- [ ] Type new value in secret field — save — new value written
- [ ] Toggle dev_mode — save — settings.json dev_mode updated
- [ ] pytest tests/ -v — all tests still passing

---

## SESSION SUMMARY FORMAT

After completing all fixes output:

FILES MODIFIED: [list]
MISMATCHES FOUND: [list from your analysis]
FIXES APPLIED: [list]
MANUAL TEST RESULTS: [each checkbox above with PASS/FAIL]
TESTS: [pytest result]
CONSTITUTION VIOLATIONS: NONE or [list]
DEFINITION OF DONE: PASS or [what failed]
