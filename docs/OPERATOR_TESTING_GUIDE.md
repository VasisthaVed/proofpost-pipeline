# ProofPost — Operator Testing Guide

This guide defines how a human operator should verify the system's operational integrity.

---

## 1. PRE-FLIGHT CHECKS
- Ensure backend is running (`npm run dev` or equivalent).
- Check `dashboard` health dots (all should be green).
- Verify that `DEV_MODE` is enabled in settings if testing without real webhooks.

## 2. INGESTION TEST
- Trigger a test webhook (or use the `PHASE1_OPERATIONAL` mock script).
- Verify the event appears in the `observability` timeline.
- Verify the fact appears in the `workspace` list.

## 3. VERIFICATION TEST
- In the `workspace`, select the new fact.
- Verify the "Verification Evidence" panel shows source text.
- Confirm the confidence score aligns with the evidence.

## 4. EDIT & PREVIEW TEST
- Select the `Bluesky` tab.
- Edit the fact summary.
- Verify the preview updates reactively.
- Refresh the page and verify the draft persists (rehydration).

## 5. DISPATCH TEST
- Click "Approve".
- Verify the status moves to `APPROVING` then `DISPATCHING`.
- Confirm the post appears on the target platform (or check the `DRY_RUN` log).
- Verify the fact moves from `workspace` to `history`.

## 6. ERROR HANDLING TEST
- Temporarily disconnect the internet or stop the backend.
- Attempt an action and verify the canonical error message appears.
- Reconnect and verify recovery.
