# ProofPost Known Issues
# docs/KNOWN_ISSUES.md

This document tracks known architectural, operational, and UX issues that are identified but not yet resolved in the current V1 cycle.

## 1. Architectural Issues

### Event Loop Blocking in Gemini Provider
The current implementation of `extraction/gemini_provider.py` uses the synchronous `client.models.generate_content` method. Since this is called within an `async` function, it will block the FastAPI event loop for the duration of the AI request (typically 5-15 seconds).
*   **Impact**: Performance degradation under concurrent webhook requests.
*   **Resolution**: Migrate to `client.aio.models.generate_content` in V1.1.

### Retry Stub
The file `execution/retry.py` is currently a minimal stub. While exponential backoff and jitter are implemented within the `Dispatcher`, the specialized retry engine described in the architecture docs is not fully decoupled.
*   **Impact**: Maintainability.
*   **Resolution**: Refactor retry logic into `execution/retry.py` during V1 cleanup.

## 2. Operational Issues

### Deprecated Package Warnings
The system environment may still throw warnings regarding the `google-generativeai` package being deprecated, even though the project has migrated to `google-genai`.
*   **Impact**: Noise in logs.
*   **Resolution**: Perform `pip uninstall google-generativeai` on the production host.

## 3. UI/UX Issues

### Missing Post Previews
The "Review Workspace" (Pending view) does not yet show a visual preview of how a post will appear on specific platforms (e.g., Bluesky "Skeet" layout).
*   **Impact**: Operator must trust the text summary without seeing formatting.
*   **Resolution**: Implement platform-specific preview components in `ui/index.html`.

### Limited Source Context
The UI displays the `source_snippet` but does not provide direct links to the GitHub PR or repository for deeper verification.
*   **Impact**: Operator must manually navigate to GitHub to cross-reference complex facts.
*   **Resolution**: Add hyperlink generation for `source_repo` and `source_commit` metadata in the UI.

### Manual Settings Verification
The UI allows saving settings but does not perform a "Test AI Connection" or "Validate HMAC" check immediately after saving.
*   **Impact**: Configuration errors are only discovered during the next webhook event.
*   **Resolution**: Add a "Validate Ingestion Settings" button to the Settings view.
