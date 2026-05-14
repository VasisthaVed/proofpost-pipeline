# ProofPost — Phase 1 Operational Completion
# docs/sessions/PHASE1_OPERATIONAL.md
# Goal: prove the system works end-to-end TODAY

---

## WHAT YOU ARE DOING TODAY

Not adding features. Not polishing UI.
You are proving the pipeline runs for real.

End state by tonight:
1. DEV_MODE works — app starts without real credentials
2. DRY_RUN works — pipeline runs without posting to real platforms
3. Real AI connected — Gemini Flash extracts real facts
4. Bluesky connected — one real platform posting
5. ngrok running — GitHub can reach your local machine
6. Full pipeline executed — you push code, you see facts, you approve, it posts

---

## STEP 1 — DEV_MODE + DRY_RUN (Anti-Gravity Session)

```
/build-module

ALLOWED:
- core/config.py
- core/models.py
- core/main.py
- settings.json

FORBIDDEN: everything else

Add DEV_MODE and DRY_RUN to the system.

1. In core/config.py add to Settings:
   dev_mode: bool = False
   dry_run: bool = False

2. In settings.json add:
   "dev_mode": true,
   "dry_run": true

3. In core/main.py:
   - On startup log: "app.mode" with dev_mode and dry_run values
   - If dev_mode=true: skip HMAC verification (accept all webhooks)
   - If dry_run=true: skip actual platform dispatch
     Instead log: "dispatch.dry_run" with fact summary and target platforms
     Return success without calling platform adapters

4. In execution/dispatcher.py:
   - Check dry_run setting before calling adapter.dispatch()
   - If dry_run=true: log the fact, mark as dispatched, skip real API call

Tests:
- test_dev_mode_skips_hmac()
- test_dry_run_skips_dispatch()
```

Commit:
```bash
git add core/config.py core/main.py execution/dispatcher.py settings.json
git commit -m "feat: DEV_MODE and DRY_RUN for safe local testing"
```

---

## STEP 2 — Connect Real AI (Gemini Flash)

### Get your free API key first:
1. Go to https://aiskudio.google.com
2. Click "Get API Key"
3. Create key — no credit card needed
4. Copy it

### Then run this Anti-Gravity session:

```
/build-module

ALLOWED:
- extraction/gemini_provider.py (create)
- extraction/extractor.py
- core/config.py
- settings.json
- tests/test_gemini_provider.py

FORBIDDEN: everything else

Build extraction/gemini_provider.py — real Gemini AI provider.

It must:
- Extend BaseLLMProvider from extraction/mock_provider.py
- Use Google Generative AI API (google-generativeai package)
- Implement extract_facts(payload: dict) -> list[VerifiedBuildFact]
- Send this prompt to Gemini:

  SYSTEM: You are a technical fact extractor. Extract only 
  verifiable engineering facts from this payload. Each fact 
  must be directly supported by text in the payload.
  Return JSON array of facts with fields:
  fact_type, summary, source_snippet, detail

- Parse response into list[VerifiedBuildFact]
- Timeout: 15 seconds
- On failure: log error, return empty list

In core/config.py add:
class AISettings(BaseModel):
    provider: str = "mock"
    api_key: str = ""
    model: str = "gemini-2.0-flash"

In extraction/extractor.py:
- Add factory function: create_provider(settings) -> BaseLLMProvider
  If provider="gemini": return GeminiProvider(api_key, model)
  If provider="mock": return MockLLMProvider()

In settings.json add:
"ai": {
  "provider": "gemini",
  "api_key": "YOUR_KEY_HERE",
  "model": "gemini-2.0-flash-exp"
}

Tests use MockLLMProvider only — never call real Gemini in tests.
```

**After session — add your real key to settings.json:**
```json
"ai": {
  "provider": "gemini",
  "api_key": "AIza...(your real key)",
  "model": "gemini-2.0-flash-exp"
}
```

Commit (WITHOUT the real key — use example file):
```bash
git add extraction/gemini_provider.py extraction/extractor.py
git commit -m "feat: Gemini Flash provider for real fact extraction"
```

---

## STEP 3 — Connect Bluesky (Simplest Real Platform)

### Get your Bluesky app password first:
1. Go to https://bsky.app
2. Settings → Privacy and Security → App Passwords
3. Add App Password → name it "proofpost"
4. Copy the password (format: xxxx-xxxx-xxxx-xxxx)

### Then run this Anti-Gravity session:

```
/build-module

ALLOWED:
- platforms/bluesky.py (create or rewrite)
- tests/test_bluesky.py
- settings.json

FORBIDDEN: everything else

Build platforms/bluesky.py — real Bluesky adapter.

Uses AT Protocol via atproto package.

Must implement:
- authenticate() -> bool
  Login with handle + app_password via atproto Client
  Return True on success, False on failure

- generate_payload(fact: VerifiedBuildFact) -> dict
  Create Bluesky post text from fact.summary
  Max 300 characters
  Add relevant hashtags based on fact.fact_type

- dispatch(fact: VerifiedBuildFact) -> dict
  Call authenticate() first
  Post to Bluesky using atproto client.send_post()
  Return {"success": bool, "url": str, "error": str}

Load credentials from settings:
settings.platforms.bluesky.handle
settings.platforms.bluesky.app_password

If dry_run=true in settings: skip real post, return mock success

Tests mock all atproto calls — never real network in tests.
```

**Add to settings.json:**
```json
"platforms": {
  "bluesky": {
    "enabled": true,
    "handle": "yourhandle.bsky.social",
    "app_password": "xxxx-xxxx-xxxx-xxxx"
  }
}
```

Commit:
```bash
git add platforms/bluesky.py tests/test_bluesky.py
git commit -m "feat: Bluesky adapter with AT Protocol"
```

---

## STEP 4 — Set Up ngrok

ngrok lets GitHub reach your local machine.

### Install ngrok:
```bash
# Download from https://ngrok.com/download
# Or via winget:
winget install ngrok
```

### Get free account:
1. Go to https://ngrok.com
2. Sign up free
3. Copy your authtoken from dashboard
4. Run: ngrok config add-authtoken YOUR_TOKEN

### Start ngrok:
```bash
# In a NEW terminal (keep this running):
ngrok http 7821
```

You'll see something like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:7821
```

Copy that URL — you need it for GitHub.

---

## STEP 5 — Connect GitHub Webhook

1. Go to any GitHub repo you own
2. Settings → Webhooks → Add webhook
3. Payload URL: `https://abc123.ngrok-free.app/webhook/github`
4. Content type: `application/json`
5. Secret: copy the `hmac_secret` from your settings.json
   (if it's "dev-secret-change-in-production" use that)
6. Events: select "Push events"
7. Active: ✅
8. Click Add webhook

GitHub will send a ping — you'll see it in your terminal logs.

---

## STEP 6 — First Real End-to-End Test

### Start the system:
```bash
# Terminal 1 — ProofPost backend:
uvicorn main:app --host 127.0.0.1 --port 7821 --reload

# Terminal 2 — ngrok tunnel:
ngrok http 7821
```

### Open dashboard:
Go to http://127.0.0.1:7821

### Trigger the pipeline:
Make any small change to your repo and push:
```bash
# In your test repo:
echo "test" >> test.txt
git add test.txt
git commit -m "test: trigger ProofPost pipeline"
git push
```

### Watch what happens:
In Terminal 1 you should see:
```
webhook.received
ingestion.hmac_verified
extraction.started
extraction.facts_extracted  count=2
verification.verified       count=2
dispatch.dry_run            platform=bluesky  (if dry_run=true)
```

In the dashboard at http://127.0.0.1:7821:
- Go to Pending view
- You should see extracted facts waiting for approval
- Click Approve
- Watch the dispatch logs

### If dry_run=true (recommended for first test):
No real post goes to Bluesky. You just prove the pipeline works.

### When ready for real post:
Change settings.json:
```json
"dry_run": false
```
Restart, push again, approve — real post goes to Bluesky.

---

## TROUBLESHOOTING

### Webhook shows 401 Unauthorized
Your HMAC secret in GitHub doesn't match settings.json
Either set dev_mode=true in settings.json to skip HMAC
Or copy the exact secret from settings.json to GitHub webhook config

### Webhook shows 200 but no facts appear
Check extraction logs — AI may have returned empty list
Try with a more descriptive commit message like:
"feat: add Redis caching to user sessions, reduces latency by 40%"

### Bluesky dispatch fails
Run: POST http://127.0.0.1:7821/api/platforms/bluesky/test
Check the error message — usually wrong handle format or expired password

### ngrok URL keeps changing (free tier)
That's normal on free tier. Just update the GitHub webhook URL each time.
Or pay $8/month for a static domain — optional.

---

## END STATE CHECKLIST

Before moving to Phase 2:

- [ ] DEV_MODE implemented and tested
- [ ] DRY_RUN implemented and tested  
- [ ] Gemini Flash connected (real extraction working)
- [ ] Bluesky adapter connected
- [ ] ngrok running and GitHub webhook connected
- [ ] Pushed a real commit and saw facts appear in dashboard
- [ ] Clicked Approve and saw dispatch log
- [ ] At least one real Bluesky post (dry_run=false)
- [ ] All 85+ tests still passing

When every box is checked: ProofPost is real.
Not finished. Real.
