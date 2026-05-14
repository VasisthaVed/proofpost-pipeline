# ProofPost V1.1 — Complete UI/UX Specification
# docs/v1.1/UI_SPEC.md
# Research-backed. Production-grade. V2-compatible.

---

## EXECUTIVE DECISION: TECH STACK

After research, here is the final decision:

### Frontend Stack
```
Language:     Vanilla JavaScript (ES Modules)
Styling:      CSS Variables + CSS Grid/Flexbox
State:        JavaScript Proxy-based reactive store
Routing:      History API (pushState) — no library
Components:   Native Web Components (Custom Elements)
Icons:        Lucide Icons (SVG sprite, no CDN dependency)
Fonts:        Inter (UI) + JetBrains Mono (data/code)
Build:        NONE — ES Modules work natively in browser
```

### Why NOT React/Vue/Svelte:
- No build step means Anti-Gravity can edit files directly
- No npm means no dependency vulnerabilities
- FastAPI serves static files — no separate frontend server
- ProofPost is a local operator tool — bundle size irrelevant
- In 2025, native browser APIs like Web Components have matured into production-grade tools that replace what frameworks once offered
- The Proxy API has revolutionized reactive state in vanilla JavaScript — patterns are now production-ready and thoroughly tested

### Why NOT pure single-file HTML anymore:
- Current index.html is already 800+ lines
- V1.1 adds 4 major new views — will hit 2000+ lines
- Impossible to maintain, impossible for AI to edit accurately
- Modular ES Modules = same simplicity, maintainable structure

---

## PAGES / VIEWS — COMPLETE LIST

### What ProofPost V1.1 has:

```
/                   → redirects to /dashboard
/setup              → first-run onboarding wizard (new users)
/dashboard          → system health overview
/workspace          → post review and approval (THE HEART)
/observability      → pipeline event timeline
/history            → dispatch archive
/platforms          → platform connection management
/settings           → configuration
/docs               → embedded documentation
```

### What ProofPost V1.1 does NOT have:
- No homepage (this is a local operator tool, not a SaaS)
- No login page (single-user local tool in V1)
- No pricing page
- No public marketing pages
- No user accounts

Login/auth comes in V2 when multi-user is added.
Homepage comes when ProofPost becomes a hosted SaaS product.

---

## APP SHELL STRUCTURE

```
┌─────────────────────────────────────────────────────┐
│  TOPBAR                                             │
│  [ProofPost logo] [repo selector] [health dot] [⚙]  │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ SIDEBAR  │  MAIN STAGE                              │
│          │                                          │
│ Dashboard│  (view swaps here)                       │
│ Workspace│                                          │
│ Observe  │                                          │
│ History  │                                          │
│ Platforms│                                          │
│ Settings │                                          │
│ Docs     │                                          │
│          │                                          │
│ ──────── │                                          │
│ [status] │                                          │
└──────────┴──────────────────────────────────────────┘
```

---

## FILE STRUCTURE (V1.1)

```
ui/
├── index.html              ← app shell only (nav + layout)
├── app.js                  ← boot, router init
├── router.js               ← History API routing
├── store.js                ← Proxy-based reactive state
├── api.js                  ← all fetch() calls
├── components/
│   ├── pp-status-dot.js    ← green/amber/red dot
│   ├── pp-fact-card.js     ← fact approval card
│   ├── pp-platform-card.js ← platform connection card
│   ├── pp-toast.js         ← notification toast
│   ├── pp-modal.js         ← confirmation modal
│   ├── pp-loading.js       ← loading spinner
│   └── pp-empty-state.js   ← empty view state
├── views/
│   ├── setup.js            ← onboarding wizard
│   ├── dashboard.js        ← health overview
│   ├── workspace.js        ← fact review (main view)
│   ├── observability.js    ← pipeline timeline
│   ├── history.js          ← dispatch archive
│   ├── platforms.js        ← platform management
│   ├── settings.js         ← configuration
│   └── docs.js             ← embedded docs
├── styles/
│   ├── tokens.css          ← design tokens (colors, fonts)
│   ├── base.css            ← reset + body styles
│   ├── layout.css          ← shell, sidebar, topbar
│   ├── components.css      ← shared component styles
│   └── themes/
│       ├── dark.css        ← dark theme (default)
│       └── light.css       ← light theme (toggle)
└── assets/
    ├── icons.svg           ← Lucide icon sprite
    └── logo.svg            ← ProofPost logo
```

---

## DESIGN SYSTEM

### Color Tokens (CSS Variables)

```css
/* Dark theme (default) */
:root[data-theme="dark"] {
  /* Backgrounds */
  --bg-base:        #0D0D14;   /* page background */
  --bg-surface:     #13131E;   /* card background */
  --bg-raised:      #1A1A2E;   /* elevated elements */
  --bg-overlay:     #22223A;   /* modals, dropdowns */

  /* Borders */
  --border-subtle:  #1E1E35;
  --border-default: #2A2A45;
  --border-strong:  #3D3D6B;

  /* Text */
  --text-primary:   #F0F0FF;
  --text-secondary: #9898BB;
  --text-muted:     #5A5A7A;
  --text-inverse:   #0D0D14;

  /* Brand */
  --brand-primary:  #6366F1;   /* indigo — trust, precision */
  --brand-glow:     rgba(99,102,241,0.2);

  /* Status */
  --status-green:   #10B981;
  --status-amber:   #F59E0B;
  --status-red:     #EF4444;
  --status-blue:    #3B82F6;
  --status-purple:  #8B5CF6;

  /* Status backgrounds */
  --status-green-bg:  rgba(16,185,129,0.1);
  --status-amber-bg:  rgba(245,158,11,0.1);
  --status-red-bg:    rgba(239,68,68,0.1);
  --status-blue-bg:   rgba(59,130,246,0.1);

  /* Typography */
  --font-ui:    'Inter', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.6);
}

/* Light theme */
:root[data-theme="light"] {
  --bg-base:        #F8F8FC;
  --bg-surface:     #FFFFFF;
  --bg-raised:      #F0F0F8;
  --bg-overlay:     #EAEAF5;
  --border-subtle:  #E8E8F0;
  --border-default: #D0D0E0;
  --border-strong:  #B0B0CC;
  --text-primary:   #0D0D14;
  --text-secondary: #4A4A6A;
  --text-muted:     #9898BB;
  --text-inverse:   #F0F0FF;
  /* Status colors same as dark */
}
```

### Typography Scale
```css
--text-xs:   11px / 1.4  (labels, badges)
--text-sm:   13px / 1.5  (secondary content)
--text-base: 14px / 1.6  (body text)
--text-md:   16px / 1.5  (subheadings)
--text-lg:   20px / 1.3  (headings)
--text-xl:   28px / 1.2  (page titles)
--text-2xl:  36px / 1.1  (hero numbers)
```

### Design Principles
- Use deep greys instead of pure black — prevents high contrast strain
- Minimum contrast ratio 4.5:1 for text to background
- Color only carries meaning: green=verified/safe, amber=uncertain/warning, red=failed/danger
- Sidebar navigation + modular cards for reusable components
- No gradients on data elements — gradients are for brand accents only
- Monospace font for ALL data: facts, snippets, hashes, timestamps, IDs

---

## VIEW SPECIFICATIONS

---

### VIEW 1 — Setup Wizard (/setup)

**Trigger:** Shown automatically on first run if settings.json is empty.
After completion: redirect to /dashboard and never show again.

**Flow:**
```
Step 1: Welcome
  "ProofPost turns your GitHub commits into verified platform posts."
  [Get Started →]

Step 2: Connect AI
  Choose provider: [Groq] [Gemini] [Mock (testing)]
  Paste API key
  [Test Connection] → green check / red error
  [Next →]

Step 3: Connect Platform
  [Bluesky] [LinkedIn] (more coming)
  Handle input + App Password
  [Test Connection] → green check / red error
  [Next →]

Step 4: Connect GitHub
  Shows your ngrok URL automatically (GET /api/ngrok-url or manual paste)
  Step-by-step GitHub webhook setup with screenshots
  [I've added the webhook →]
  [Send Test Ping] → waits for webhook, shows green when received

Step 5: Ready
  "ProofPost is configured."
  Summary of what's connected
  [Open Dashboard →]
```

**UX rules:**
- User cannot skip steps with errors
- Each step validates before proceeding
- Plain English everywhere — no technical jargon without explanation
- HMAC, webhook, API key — all have (?) tooltip explanations

---

### VIEW 2 — Dashboard (/dashboard)

**Purpose:** At-a-glance system health. Not data-heavy.

**Layout:**
```
┌─────────────────────────────────────┐
│  System Health                      │
│  [Backend ●] [DB ●] [AI ●] [Queue]  │
├──────────────┬──────────────────────┤
│ Pending      │ Recent Activity      │
│ [N facts]    │ (last 5 events)      │
│ [Review →]   │                      │
├──────────────┴──────────────────────┤
│ Connected Platforms                  │
│ [Bluesky ●] [LinkedIn ●]            │
└─────────────────────────────────────┘
```

**Behavior:**
- Polls /health every 15 seconds
- Pending count badge in sidebar updates in real time
- Clicking any section navigates to the relevant view
- If pending > 0: amber pulsing dot on Workspace nav item

---

### VIEW 3 — Workspace (/workspace) ← THE HEART

**Purpose:** Human reviews, edits, approves or rejects facts.
This is where ProofPost's value is most visible.

**Layout — Split View:**
```
┌─────────────────────┬───────────────────────────┐
│  FACT LIST          │  REVIEW PANEL             │
│  (left sidebar)     │  (main stage)             │
│                     │                           │
│  [fact 1] ←selected │  [fact type badge]        │
│  [fact 2]           │  [summary text - editable]│
│  [fact 3]           │                           │
│                     │  PLATFORM PREVIEW TABS    │
│                     │  [Bluesky] [LinkedIn]     │
│                     │  ┌─────────────────────┐  │
│                     │  │ preview of post     │  │
│                     │  │ as it will appear   │  │
│                     │  │ char count: 180/300 │  │
│                     │  └─────────────────────┘  │
│                     │                           │
│                     │  VERIFICATION EVIDENCE    │
│                     │  ┌─────────────────────┐  │
│                     │  │ source snippet      │  │
│                     │  │ highlighted match   │  │
│                     │  │ confidence: 100%    │  │
│                     │  └─────────────────────┘  │
│                     │                           │
│                     │  [Reject] [Approve →]     │
└─────────────────────┴───────────────────────────┘
```

**Features:**
- Editable summary — operator can refine before approving
- Platform tabs show real character limits per platform
- Verification evidence always visible — shows WHY it was verified
- Source snippet with matched text highlighted
- Confidence score with plain English explanation
- Approve requires confirmation if confidence < 0.8
- Keyboard: A = approve, R = reject, ← → = navigate facts

---

### VIEW 4 — Observability (/observability)

**Purpose:** Visual pipeline timeline. Shows what happened and when.

**Layout:**
```
Event: push/abc123 — 2 minutes ago
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● Webhook Received     18:02:38  [7,774 bytes]
  ↓ 0ms
● Size Check           18:02:38  [PASS]
  ↓ 0ms
● HMAC Verified        18:02:38  [dev_mode skip]
  ↓ 12ms
● Extraction           18:02:39  [1 fact found]
  ↓ 8ms
● Verification         18:02:39  [1 verified, 0 rejected]
  ↓ 2ms
● Persisted to DB      18:02:39  [hash: a8b67ef...]
  ↓ waiting...
○ Pending Approval     [WAITING — 2m ago]
```

**After approval:**
```
● Approved             18:05:19  [by operator]
  ↓ 1ms
● Dispatched           18:05:22  [Bluesky]
  ↓ success
✓ Complete             [post: bsky.app/profile/...]
```

**Features:**
- Live updates via polling every 5 seconds
- Click any step to expand details
- Color: green = success, amber = waiting, red = failed
- Shows all recent events, not just current
- Search/filter by event ID, status, date

---

### VIEW 5 — History (/history)

**Purpose:** Archive of all dispatched posts.

**Layout:**
```
Filters: [All platforms ▼] [Last 7 days ▼] [Status ▼]

┌────────────────────────────────────────────────────┐
│ 2026-05-13 18:05  │ Bluesky │ "User authentication │
│ feat_819efbab     │ ✓ sent  │  implemented" → [↗]  │
├────────────────────────────────────────────────────┤
│ 2026-05-13 10:48  │ Bluesky │ "New capability..."  │
│ mock_fact_1       │ ✓ sent  │                → [↗] │
└────────────────────────────────────────────────────┘
```

**Features:**
- Pagination (20 per page)
- Click row to see full fact + verification evidence
- External link to actual platform post
- Filter by platform, status, date range
- Export as CSV

---

### VIEW 6 — Platforms (/platforms)

**Purpose:** Connect, test, and manage platform integrations.

**Layout:**
```
┌───────────────────────────────────┐
│ 🦋 Bluesky              ● Connected│
│ @dacorvo.bsky.social               │
│ Last tested: 2 min ago ✓           │
│ [Test Connection] [Disconnect]     │
├───────────────────────────────────┤
│ 💼 LinkedIn             ○ Not set  │
│ Connect to enable LinkedIn posts   │
│ [Connect LinkedIn]                 │
├───────────────────────────────────┤
│ + Add Platform                     │
│ Reddit · Mastodon · Dev.to (V2)    │
└───────────────────────────────────┘
```

---

### VIEW 7 — Settings (/settings)

**Purpose:** Configuration. Must work perfectly.

**Tabs:** AI Provider | Ingestion | Environment | Danger Zone

**AI Provider tab:**
- Provider dropdown: Mock / Groq / Gemini
- API key field (password type, masked after save)
- Model field
- Test connection button → real API call
- Last tested timestamp

**Ingestion tab:**
- HMAC secret (masked)
- Max payload size
- Webhook URL display (read-only, with copy button)

**Environment tab:**
- DEV_MODE toggle (with explanation tooltip)
- DRY_RUN toggle (with explanation tooltip)
- Environment label

**Danger Zone tab:**
- Clear database button (with confirmation)
- Reset settings button (with confirmation)

---

### VIEW 8 — Docs (/docs)

**Purpose:** Embedded documentation. No external links needed.

**Sections:**
- What is ProofPost? (plain English, 200 words)
- How the pipeline works (visual diagram)
- Setting up GitHub webhooks (step by step with screenshots)
- Getting API keys (Groq, Gemini, Bluesky, LinkedIn)
- Understanding verification (what confidence means)
- Keyboard shortcuts reference
- Troubleshooting (common errors + fixes)
- FAQ

---

## REACTIVE STATE ARCHITECTURE

```javascript
// store.js — Proxy-based reactive store
const initialState = {
  // App
  theme: 'dark',
  currentView: 'dashboard',
  loading: false,
  error: null,
  toast: null,

  // System
  health: null,
  isBackendOnline: false,

  // Data
  pendingFacts: [],
  history: { items: [], total: 0 },
  platforms: [],
  settings: null,
  events: [],       // observability events

  // UI state
  selectedFactId: null,
  selectedPlatformTab: 'bluesky',
  setupComplete: false,
  setupStep: 1,
}

// Usage:
store.pendingFacts = [...facts]  // triggers re-render automatically
store.theme = 'light'            // triggers theme switch automatically
```

---

## ROUTING SYSTEM

```javascript
// router.js
const routes = {
  '/':              () => redirectTo('/dashboard'),
  '/setup':         () => renderView('setup'),
  '/dashboard':     () => renderView('dashboard'),
  '/workspace':     () => renderView('workspace'),
  '/observability': () => renderView('observability'),
  '/history':       () => renderView('history'),
  '/platforms':     () => renderView('platforms'),
  '/settings':      () => renderView('settings'),
  '/docs':          () => renderView('docs'),
}

// Navigation:
router.navigate('/workspace')
// Updates browser URL + renders correct view
// Back/forward browser buttons work correctly
```

---

## SECURITY REQUIREMENTS

Based on research findings:

**Input sanitization:**
- All GitHub webhook content treated as untrusted
- escapeHtml() on every piece of user-generated content
- Never innerHTML with API data

**API security:**
- All API calls to window.location.origin only
- CSP: `connect-src 'self'`
- No external CDN dependencies (fully offline capable)

**Credential handling:**
- API keys never shown in plain text after save
- Password fields for all secrets
- Show/hide toggle acceptable
- Keys masked as **** in GET /api/settings response
- **** value on save = preserve existing (don't overwrite)

**Local tool security:**
- No authentication in V1 (single user, local only)
- CORS: FastAPI allows localhost only
- Settings.json in .gitignore always

---

## ACCESSIBILITY REQUIREMENTS

- Minimum contrast 4.5:1 everywhere
- All interactive elements keyboard focusable
- Keyboard shortcuts documented
- ARIA labels on icon-only buttons
- Focus indicators visible
- Error messages associated with form fields
- Loading states announced to screen readers

---

## CANONICAL API ERROR OBJECT

All API failures must return:
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

---

## ANIMATION GUIDELINES

- Functional animations only — no decorative movement
- View transitions: 150ms fade
- Toast: 200ms slide up, auto-dismiss 3s
- Loading spinner: CSS only, no JS
- Status dot pulse: CSS keyframe, 2s loop
- No parallax, no scroll effects, no 3D transforms
- Respect prefers-reduced-motion media query

---

## DARK / LIGHT MODE

- Dark mode is default (operator tool, long sessions)
- Light mode available via toggle in topbar
- Theme stored in localStorage
- CSS variables switch instantly via data-theme attribute on html element
- No flash on load (theme applied before first render)
- System preference respected on first visit

---

## BUILD ORDER FOR V1.1

### Phase A — Foundation (build first, nothing else)
1. File structure created (all empty files with docstrings)
2. tokens.css — design tokens locked
3. store.js — reactive state working
4. router.js — navigation working
5. api.js — all endpoints wrapped
6. index.html — app shell (nav + layout only)
7. Basic dark/light theme switch working

### Phase B — Core Views
8. dashboard.js — health display
9. workspace.js — fact review (most important)
10. settings.js — configuration (must work perfectly)
11. platforms.js — platform management

### Phase C — Experience
12. setup.js — onboarding wizard
13. observability.js — pipeline timeline
14. history.js — dispatch archive
15. docs.js — embedded documentation

### Phase D — Polish
16. Keyboard shortcuts
17. Animations and transitions
18. Mobile responsive adjustments
19. Accessibility audit
20. Light theme polish

---

## WHAT V2 ADDS TO THIS SHELL

V2 simply adds new views inside the existing shell:
- /workspace/semantic — clustering view
- /repository — repo memory view
- /narratives — release storytelling
- /analytics — engagement metrics
- /team — multi-user (requires login)

The shell, routing, state, components, and design system
do NOT change. V2 extends, it doesn't rewrite.

---

## GOVERNANCE DOCS TO CREATE FOR V1.1

New files needed in docs/v1.1/:
- UI_SPEC.md (this file)
- UI_COMPONENT_CATALOG.md (each component documented)
- UI_STATE_SCHEMA.md (complete state object documented)
- UI_API_INTEGRATION.md (which view calls which endpoint)
- ONBOARDING_FLOW.md (setup wizard step by step)
- WORKSPACE_SPEC.md (fact review workspace detailed spec)

New Anti-Gravity workflow needed:
- /build-view (for building individual view files)
- /build-component (for building Web Components)
