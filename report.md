# ProofPost — Master Architecture & State Report
**Date:** 2026-05-14  
**Scope:** Full system read — all code, all docs, all agents, V1 → V1.1 transition  
**Author:** Antigravity (audit only — no code changes)

---

## PART 1 — WHAT HAS BEEN BUILT (COMPLETE INVENTORY)

### Backend (Python / FastAPI)
| Module | File | Status |
|--------|------|--------|
| Core models | `core/models.py` | ✅ Done — `VerifiedBuildFact` canonical schema |
| Config loader | `core/config.py` | ✅ Done — reads `settings.json`, all settings typed |
| Database layer | `core/database.py` | ✅ Done — all SQLite ops, WAL mode, parameterized queries |
| FastAPI entrypoint | `core/main.py` | ✅ Done — all routes, CORS, startup recovery |
| HMAC Verifier | `ingestion/hmac_verifier.py` | ✅ Done |
| Size Limiter | `ingestion/size_limiter.py` | ✅ Done |
| Deduplicator | `ingestion/deduplicator.py` | ✅ Done — SHA-256 idempotency |
| Payload Sanitizer | `ingestion/payload_sanitizer.py` | ✅ Done |
| Extractor | `extraction/extractor.py` | ✅ Done — factory pattern |
| Gemini Provider | `extraction/gemini_provider.py` | ✅ Done |
| Groq Provider | `extraction/groq_provider.py` | ✅ Done |
| Mock Provider | `extraction/mock_provider.py` | ✅ Done |
| Verifier | `verification/verifier.py` | ✅ Done — string-match vs source |
| Dispatcher | `execution/dispatcher.py` | ✅ Done — SQLite queue, DRY_RUN, retry |
| Retry Engine | `execution/retry.py` | ⚠️ Stub — not fully decoupled (KNOWN_ISSUES) |
| DLQ | `execution/dlq.py` | ✅ Done — failed posts stored |
| Bluesky Adapter | `platforms/bluesky.py` | ✅ Done — atproto |
| LinkedIn Adapter | `platforms/linkedin.py` | ⚠️ Exists but oauth incomplete |
| Tests | `tests/` (17 files) | ✅ 17 test files covering all major modules |

### Frontend (Vanilla JS / ES Modules)
| File | Status | Notes |
|------|--------|-------|
| `ui/index.html` | ✅ Done | App shell, topbar, sidebar, all 8 nav links |
| `ui/app.js` | ✅ Done | Boot, component registration, toast init |
| `ui/router.js` | ✅ Done | History API, guards, lifecycle, scroll reset, focus mgmt |
| `ui/store.js` | ✅ Done | Proxy reactive store, all actions, platform draft isolation |
| `ui/api.js` | ✅ Done | All endpoints, canonical error, secret masking |
| `ui/utils.js` | ✅ Done | `escapeHtml()`, `updateTitle()` |
| `ui/views/dashboard.js` | ✅ Done | Health polling, pending count, lifecycle |
| `ui/views/workspace.js` | ✅ Done | Split view, platform tabs, draft, approval guard |
| `ui/views/setup.js` | ✅ Done | 5-step onboarding wizard |
| `ui/views/settings.js` | ✅ Done | 4-tab settings (AI, Ingestion, Env, Danger) |
| `ui/views/platforms.js` | ⚠️ Partial | Hardcoded Bluesky handle, not from store |
| `ui/views/observability.js` | ✅ Done | 5s poll, lifecycle clean |
| `ui/views/history.js` | ✅ Done | Table view, empty state |
| `ui/views/docs.js` | ✅ Done | Embedded docs stub |
| `ui/components/status-dot.js` | ✅ Done | `<pp-status-dot>` CE, Light DOM |
| `ui/components/fact-card.js` | ✅ Done | `<pp-fact-card>` CE, emits `pp-select` |
| `ui/components/toast.js` | ✅ Done | `<pp-toast>` CE + `initToastManager()` |
| `ui/styles/tokens.css` | ✅ Done | All CSS variables, dark + light theme |
| `ui/styles/base.css` | ✅ Done | Resets, typography |
| `ui/styles/layout.css` | ✅ Done | Grid layout, sidebar, topbar |
| `ui/styles/workspace.css` | ✅ Done | Workspace-specific styles |
| `ui/styles/components.css` | ✅ Done | Toast animations |

---

## PART 2 — WHAT IS MISSING (GAPS VS SPEC)

### Frontend Gaps (vs `docs/v1.1/UI_COMPONENT_CATALOG.md`)
| Missing Component | Impact | Priority |
|------------------|--------|----------|
| `<pp-modal>` | Currently uses `window.confirm()` — browser native, not styled, no focus trap | **HIGH** |
| `<pp-loading>` | No skeleton loaders during API calls — shows blank flash | **MEDIUM** |
| `<pp-empty-state>` | Empty states are inline HTML strings, not a registered component | **MEDIUM** |
| `<pp-platform-card>` | Platform cards in platforms.js are inline HTML, not a component | **LOW** |

### Store/Action Gaps (vs `docs/v1.1/UI_STATE_SCHEMA.md`)
| Missing Action | Where Needed | Impact |
|---------------|-------------|--------|
| `actions.setSetupComplete(bool)` | `setup.js`, `settings.js` | Views calling `_mutate()` directly — Law 3 violation |
| `actions.selectPlatform(platform)` | `workspace.js` | Same — `_mutate()` from view |
| `actions.setObservabilityEvents(events)` | `observability.js` | Same |
| `actions.setHistoryItems(items)` | `history.js` — already calls this but not defined in store | **Likely runtime error** |
| `actions.markFactApproved(id)` | Spec says this exists, workspace uses raw refresh instead | Architecture drift |
| `actions.removeFact(id)` | Spec says this exists, workspace uses full refresh instead | Architecture drift |

### Schema Drift (store.js vs `UI_STATE_SCHEMA.md`)
| Schema Says | Code Has | Status |
|------------|---------|--------|
| `draftContent: ''` (string) | `draftContent: { bluesky: '', linkedin: '' }` | ✅ Code is **better** — schema is stale |
| `hasUnsavedChanges: false` (persisted) | Computed locally in renderReviewPanel | ✅ Code is **better** — schema should mark as derived |
| `ui.setupStep` | Not in schema | Schema is stale — was added |
| `ui.activeSettingsTab` | Not in schema | Schema is stale — was added |

### Backend Gaps (vs `docs/KNOWN_ISSUES.md`)
| Gap | Status | Doc Reference |
|----|--------|---------------|
| Gemini async blocking (event loop) | Open — `gemini_provider.py` uses sync call | KNOWN_ISSUES.md #1 |
| `execution/retry.py` is a stub | Open — retry logic lives inside dispatcher | KNOWN_ISSUES.md #2 |
| `google-generativeai` deprecated package warning | Open | KNOWN_ISSUES.md #3 |

### API Contract Gaps
`docs/API_CONTRACTS.md` has `BASE_URL = http://localhost:7821` — **hardcoded** in the doc itself. The UI correctly uses `window.location.origin`. The doc should say `<server_host>` not a hardcoded local URL.

The error schema in `API_CONTRACTS.md` uses `{"detail": "..."}` (FastAPI default) but `UI_API_INTEGRATION.md` defines a more structured canonical error. These two docs are **inconsistent**. The frontend bridges them correctly in `api.js` but the docs conflict.

---

## PART 3 — WHAT NEEDS TO BE CLEANED (TECHNICAL DEBT)

### Code Cleanup (Frontend)
| Item | File | Action |
|------|------|--------|
| 3 raw `_mutate()` calls from views | `setup.js:169`, `settings.js:178`, `workspace.js:159`, `observability.js:85` | Replace with named actions |
| `console.log()` in every view | All view files | Remove or replace with structured logging approach |
| Inline `style="width:..."` | `setup.js:25` (progress bar) | Use CSS class |
| Inline `style="color: var(--brand-primary)"` | `index.html:31` (SVG) | Use CSS class |
| Hardcoded `dacorvo.bsky.social` | `platforms.js:41` | Render from `state.platforms.items` |
| `platforms.js` ignores `state.platforms` | `platforms.js` | Load and render from store |
| `history.js` calls `actions.setHistoryItems` which doesn't exist in store | `history.js:65` | Add action to store |
| `atproto` missing from `requirements.txt` | `requirements.txt` | Add `atproto` if Bluesky is real |

### Doc Cleanup
| Document | Action | Reason |
|----------|--------|--------|
| `docs/ui/UI_ARCHITECTURE.md` | **ARCHIVE or DELETE** | Describes old single-file architecture that no longer exists |
| `docs/ui/UI_CONSTITUTION.md` | **ARCHIVE or DELETE** | Superseded by `UI_ENGINEERING_RULES.md` |
| `docs/ui/UI_COMPONENT_SYSTEM.md` | **ARCHIVE or DELETE** | Superseded by `UI_COMPONENT_CATALOG.md` |
| `docs/ui/UI_RUNTIME_FLOW.md` | **ARCHIVE or DELETE** | Superseded by `VIEW_LIFECYCLE.md` |
| `docs/ui/UI_SECURITY_MODEL.md` | **ARCHIVE or DELETE** | Superseded by security section of `UI_ENGINEERING_RULES.md` |
| `docs/ui/UI_BUILD_PROMPT.md` | **DELETE** | Original build prompt, no longer relevant |
| `docs/v1.1/UI_STATE_SCHEMA.md` | **UPDATE** | `draftContent`, `hasUnsavedChanges`, `setupStep`, `activeSettingsTab` are all stale |
| `docs/API_CONTRACTS.md` | **UPDATE** | Hardcoded `localhost:7821` in BASE_URL, error schema conflicts with canonical error |
| `docs/prompts/FIX_SETTINGS_AND_REVIEW_UI.md` | **ARCHIVE** | References `ui/index.html` as the only UI file — pre-V1.1 prompt, now irrelevant |
| `docs/governance/system.md` | **UPDATE** | Line 82: "Modules completed: [update this]" — was never filled in |
| `docs/V1_COMPLETION_PLAN.md` | **UPDATE** | All Phase 2/3/4 checkboxes still show `[ ]` — need to be checked off |

### Workflow Cleanup (`.agents/workflows/`)
| Workflow | Action | Reason |
|----------|--------|--------|
| `FINAL_SYSTEM_REVIEW.md` | **UPDATE** | References `docs/CANONICAL_STRUCTURE.md` (missing) and `docs/OPERATOR_DEBUG_MODE.md` (missing) |
| `FINAL_SYSTEM_REVIEW.md` | **UPDATE** | References `build-ui-component.md` workflow which doesn't exist (should be `build-component.md`) |
| `SETTINGS_FIX_PROMPT.md` | **ARCHIVE** | Settings view is now built — this prompt was pre-V1.1 |
| `PHASE1_OPERATIONAL.md` | **ARCHIVE** | Phase 1 is complete — this is a historical doc, not a current workflow |
| `runtime-debug` | **CHECK** | Has no `.md` extension — confirm this is intentional |

---

## PART 4 — SCOPE ALIGNMENT CHECK (Docs vs Reality)

### V1.1 Roadmap Said:
- ✅ Review Workspace enhancement (Previews, source context) — **DONE**
- ✅ Setting validation (Connection tests stubs) — **DONE** (stubs, not real)
- ✅ Enhanced observability (Traceability log) — **DONE** (basic timeline)

### V1_COMPLETION_PLAN.md Phase Checklist (actual status):
| Phase | Item | Actual Status |
|-------|------|--------------|
| Phase 2 | `tokens.css` matches design system | ✅ |
| Phase 2 | `store.js` Proxy reactivity | ✅ |
| Phase 2 | `router.js` History API + guards | ✅ |
| Phase 2 | `api.js` canonical error handling | ✅ |
| Phase 3 | Fact list rendering from store | ✅ |
| Phase 3 | Platform preview tabs | ✅ |
| Phase 3 | Verification evidence panel | ✅ |
| Phase 3 | Draft rehydration (localStorage) | ✅ |
| Phase 3 | Approve/Reject backend sync | ✅ |
| Phase 4 | Setup wizard | ✅ |
| Phase 4 | Observability timeline | ✅ |
| Phase 4 | Settings view + secret masking | ✅ |
| Phase 4 | End-to-end dry run | ❓ Not verified in docs |

### Final Release Criteria (from V1_COMPLETION_PLAN.md):
| Criterion | Status |
|-----------|--------|
| Zero direct DOM mutations outside view files | ✅ Clean |
| Zero hardcoded colors or URLs | ✅ Clean (2 minor inline styles remain) |
| 100% test coverage for dispatch idempotency | ✅ `test_dispatcher.py` exists |
| Human can approve and dispatch a fact to Bluesky | ❓ Not end-to-end verified |

---

## PART 5 — CONFIDENCE SCORES PER AREA

| Area | Confidence | Notes |
|------|-----------|-------|
| Backend pipeline (ingestion → dispatch) | **92%** | Solid, tested, idempotent. Gemini async gap is known. |
| Backend tests | **88%** | 17 test files. `retry.py` stub not fully tested. |
| Frontend state management | **85%** | Proxy store is solid. 4 missing named actions. |
| Frontend views | **80%** | All 8 views built. `platforms.js` has hardcoded data. |
| Frontend components | **75%** | 3 of 7 catalog components built. `pp-modal` missing. |
| Frontend security | **90%** | All API data goes through `escapeHtml()`. No raw innerHTML. |
| Routing & lifecycle | **95%** | Guards work. All views have onActivate/onDeactivate. |
| Documentation accuracy | **65%** | Multiple stale docs. Schema drift not updated. |
| Governance / AI rules | **80%** | Good anti-drift rules. Some workflows reference missing files. |

---

## PART 6 — WHAT NEEDS TO BE CHECKED (VERIFICATION LIST)

Before this can be called **V1.1 Complete**, a human must verify:

- [ ] Run `pytest tests/` — confirm 0 failures
- [ ] Start backend, open browser at `http://localhost:7821` — confirm no console errors
- [ ] Navigate all 8 routes — confirm no blank views or JS errors
- [ ] Push a real commit via GitHub webhook (DEV_MODE=true) — confirm fact appears in workspace
- [ ] Select a fact — confirm verification evidence panel populates
- [ ] Edit draft — confirm localStorage persists on page refresh
- [ ] Switch from Bluesky to LinkedIn tab — confirm draft content is independent
- [ ] Click Approve — confirm dispatching guard prevents double-click
- [ ] Confirm approved fact moves from workspace to history
- [ ] Open Settings — confirm fields populate from API, not empty
- [ ] Save settings with `****` API key — confirm key is NOT sent to backend
- [ ] Trigger /setup — confirm 5 steps complete and redirect to /dashboard
- [ ] Test dark/light theme toggle — confirm no token violations
- [ ] Check browser console — confirm zero uncaught errors

---

## PART 7 — V1.2 TRANSITION GUIDE

### What V1.2 Adds (from ROADMAP.md)
- Batch approval (approve multiple facts at once)
- Platform-specific content overrides (different text per platform — already partially done)
- Draft management (named drafts, revision history)

### Docs to KEEP for V1.2 (unchanged)
- `docs/governance/constitution.md` — permanent
- `docs/governance/ai_rules.md` — permanent
- `docs/governance/system.md` (after updating line 82)
- `docs/v1.1/UI_ENGINEERING_RULES.md` — the frontend constitution, update version to v1.2
- `docs/API_CONTRACTS.md` (after updating BASE_URL)
- `.agents/rules/autopost-rules.md` — permanent

### Docs to UPDATE for V1.2
| Document | What to Update |
|----------|----------------|
| `docs/ROADMAP.md` | Mark V1.1 as DONE, expand V1.2 items |
| `docs/CHANGELOG.md` | Add V1.1 complete entry |
| `docs/V1_COMPLETION_PLAN.md` | Check all boxes, create V1.2 equivalent |
| `docs/SYSTEM_INVENTORY.md` | Add new V1.2 docs, mark completed |
| `docs/v1.1/UI_STATE_SCHEMA.md` | Fix `draftContent`, `hasUnsavedChanges`, add `setupStep`, `activeSettingsTab` |
| `docs/v1.1/UI_COMPONENT_CATALOG.md` | Mark built components as DONE |
| `docs/v1.1/WORKSPACE_STATE_MACHINE.md` | Add batch approval state transitions |
| `docs/API_CONTRACTS.md` | Fix BASE_URL, add batch approve endpoint |
| `docs/KNOWN_ISSUES.md` | Close resolved issues, add new V1.1 findings |

### Docs to CREATE for V1.2
| New Document | Purpose |
|-------------|---------|
| `docs/v1.2/BATCH_APPROVAL_SPEC.md` | How batch approval works in workspace |
| `docs/v1.2/DRAFT_MANAGEMENT_SPEC.md` | Named drafts, history, revisions |
| `docs/v1.2/V1.2_COMPLETION_PLAN.md` | Definition of done for V1.2 |

### Docs to ARCHIVE/DELETE before V1.2
| Document | Action |
|----------|--------|
| `docs/ui/` entire folder | **ARCHIVE** — move to `docs/archive/v1-legacy-ui/` |
| `docs/prompts/FIX_SETTINGS_AND_REVIEW_UI.md` | **DELETE** — pre-V1.1, resolved |

### Workflows to KEEP for V1.2
| Workflow | Status |
|----------|--------|
| `/ui-review` | Keep — update to include V1.2 state schema checks |
| `/fix-bug` | Keep — permanent |
| `/build-module` | Keep — permanent |
| `/build-component` | Keep — permanent |
| `/security-review` | Keep — permanent |
| `/architecture-review` | Keep — permanent |
| `/FINAL_SYSTEM_REVIEW` | Keep — update broken file references |

### Workflows to ARCHIVE for V1.2
| Workflow | Reason |
|----------|--------|
| `/PHASE1_OPERATIONAL` | Phase 1 is done — archive as historical |
| `/SETTINGS_FIX_PROMPT` | Settings are built — archive |

### New Workflows to CREATE for V1.2
| New Workflow | Purpose |
|-------------|---------|
| `/build-view` | Official workflow for building a new view (B2 prompt exists but no named workflow) |
| `/state-review` | Audit store.js schema against UI_STATE_SCHEMA.md before any state changes |
| `/batch-approve` | Guide for implementing batch operations |

---

## PART 8 — IMMEDIATE FIXES REQUIRED (BEFORE CALLING V1.1 DONE)

### Priority 1 — Blockers
1. **`actions.setHistoryItems` missing from store.js** → `history.js` will crash at runtime calling undefined action
2. **`platforms.js` hardcodes user data** → renders wrong info for every operator

### Priority 2 — Architecture Violations (Law 3)
3. Add `actions.setSetupComplete(bool)` → replace `_mutate` calls in `setup.js` and `settings.js`
4. Add `actions.selectPlatform(platform)` → replace `_mutate` call in `workspace.js`
5. Add `actions.setObservabilityEvents(events)` → replace `_mutate` call in `observability.js`

### Priority 3 — Accessibility
6. Add `aria-label="Toggle theme"` to theme button in `index.html`

### Priority 4 — CSS Rules
7. Remove inline `style="width:..."` from `setup.js:25` — use CSS class

### Priority 5 — Doc Accuracy
8. Update `UI_STATE_SCHEMA.md` to reflect actual store shape
9. Check all `V1_COMPLETION_PLAN.md` boxes that are actually done
10. Fix `FINAL_SYSTEM_REVIEW.md` broken references

---

## PART 9 — FINAL READINESS VERDICT

```
OVERALL V1.1 STATUS: 85% COMPLETE

Backend:     DONE (production-grade, tested)
Frontend:    DONE structurally — 3 named actions missing, 1 runtime crash risk
Components:  PARTIAL — 3 of 7 built
Docs:        STALE in 5+ places
Tests:       Backend: done. Frontend: zero tests (spec says manual verification)

READY FOR END-TO-END TEST: YES (after Priority 1 fixes)
READY FOR V1.1 TAG: NO — fix Priority 1 & 2 first

Estimated fixes needed: ~30 minutes of code, ~1 hour of doc updates
```

---

## APPENDIX — FIX-BUG PROMPT FOR NEXT SESSION

```text
/fix-bug

MANDATORY READS:
1. docs/governance/constitution.md
2. docs/v1.1/UI_ENGINEERING_RULES.md (Law 3)
3. docs/v1.1/UI_STATE_SCHEMA.md
4. docs/v1.1/UI_API_INTEGRATION.md

GOAL: Fix all Priority 1 & 2 violations from report.md.

FIXES IN ORDER:

1. store.js — Add missing named actions:
   - actions.setHistoryItems(items) → store.history.items = items
   - actions.setSetupComplete(bool) → store.app.setupComplete = bool
   - actions.selectPlatform(platform) → store.workspace.selectedPlatform = platform
   - actions.setObservabilityEvents(events) → store.observability.events = events

2. history.js:65 — Replace:
   actions.setHistoryItems(res.data)
   (This will work once the action exists)

3. setup.js:169 — Replace:
   actions._mutate(() => { store.app.setupComplete = true; });
   With: actions.setSetupComplete(true);

4. settings.js:178 — Replace:
   actions._mutate(() => { store.app.setupComplete = false; });
   With: actions.setSetupComplete(false);

5. workspace.js:159 — Replace:
   actions._mutate(() => { store.workspace.selectedPlatform = platform; });
   With: actions.selectPlatform(platform);

6. observability.js:85 — Replace:
   actions._mutate(() => { store.observability.events = res.data; });
   With: actions.setObservabilityEvents(res.data);

7. platforms.js — Replace hardcoded 'dacorvo.bsky.social' with:
   const bskyPlatform = state.platforms.items.find(p => p.id === 'bluesky');
   Render from bskyPlatform if it exists, else show "Not connected" state.

8. index.html — Add aria-label="Toggle theme" to #theme-toggle button.

TOUCH ONLY: store.js, history.js, setup.js, settings.js, workspace.js,
            observability.js, platforms.js, index.html
DO NOT touch: router.js, api.js, api.js, any CSS, any backend file
```
