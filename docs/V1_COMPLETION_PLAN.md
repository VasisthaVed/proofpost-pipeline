# ProofPost V1.1 — Completion Plan

This document defines the "Definition of Done" for the V1.1 stabilization cycle.

---

## PHASE 1: GOVERNANCE & ARCHITECTURE (FREEZE)
- [x] All V1.1 documentation created and standardized.
- [x] Canonical state schema defined.
- [x] View lifecycle and routing guards defined.
- [x] Shadow DOM banned to protect global theme.
- [x] API Error shape standardized.
- [x] Approval race condition guard mandated.

## PHASE 2: FOUNDATION BUILD
- [ ] `tokens.css` matches design system spec.
- [ ] `store.js` implements Proxy-based reactivity.
- [ ] `router.js` implements History API and onboarding guards.
- [ ] `api.js` implements canonical error handling.

## PHASE 3: CORE WORKSPACE
- [ ] Fact list rendering from store.
- [ ] Platform preview tabs functional.
- [ ] Verification evidence panel visible and accurate.
- [ ] Draft rehydration from `localStorage` working.
- [ ] Approval/Reject actions sync with backend.

## PHASE 4: SYSTEM READINESS
- [ ] Setup wizard handles first-run config.
- [ ] Observability timeline shows pipeline events.
- [ ] Settings view masks secrets and validates inputs.
- [ ] End-to-end dry run successful.

---

## FINAL CRITERIA FOR RELEASE
1. Zero direct DOM mutations outside view files.
2. Zero hardcoded colors or URLs.
3. 100% test coverage for backend dispatch idempotency.
4. Human operator can successfully approve and dispatch a fact to Bluesky.
