# Workflow: security-review
# Trigger: /security-review
# Run before any ingestion, execution, or platform deployment code

## MANDATORY CONTEXT LOAD

Read these files now:
- docs/governance/constitution.md
- docs/architecture/system.md
- docs/governance/ai_rules.md

Confirm with: "Constitution read. Architecture read. Rules read. Ready."

---

## SCOPE

ALLOWED: read any file, output findings only
FORBIDDEN: modifying any file during this workflow
This workflow produces a report. Fixes happen in a separate /build-module session.

---

## SECURITY CHECKS (run all, report all findings)

### 1. Secret Handling
- Grep for hardcoded strings matching API key patterns
- Confirm all credentials load from core/config.py only
- Check settings.json is in .gitignore
- Check no credentials appear in structlog output

### 2. Injection Risks
- Review payload_sanitizer.py — does it strip HTML, script tags, template injections?
- Review all SQL queries — parameterized only? Any string formatting?
- Review any markdown rendering — could a webhook payload inject HTML?

### 3. Replay Attacks
- Does hmac_verifier.py check webhook timestamp?
- Is the window 5 minutes or less?
- Is the timestamp check before or after HMAC verification? (must be after)

### 4. Async Vulnerabilities
- Are there shared mutable objects accessed across coroutines without locks?
- Does the dispatcher have any race condition between dequeue and mark_dispatched?
- Is SQLite WAL mode enabled? (required for concurrent async reads/writes)

### 5. Unsafe Logging
- Does any log line include raw payload content? (could log injected data)
- Does any log line include credentials or tokens?
- Are all structlog calls using key=value pairs (not f-strings with user data)?

### 6. Payload Sanitization
- What is the maximum payload size enforced?
- What happens to a payload exactly at the limit vs one byte over?
- Is size checked before or after HMAC verification? (must be after)

### 7. Duplicate/Replay Protection
- Is SHA-256 hash computed before or after sanitization? (must be before)
- What is the TTL on seen hashes in the deduplicator?
- Can two concurrent requests with the same hash both pass?

### 8. Approval Expiry
- Do approved facts have a TTL? (48h recommended)
- What happens if an expired approval triggers dispatch?

---

## OUTPUT FORMAT

SECURITY REVIEW REPORT
======================
Date: [date]
Files reviewed: [list]

CRITICAL findings: [list or NONE]
HIGH findings:     [list or NONE]
MEDIUM findings:   [list or NONE]
LOW findings:      [list or NONE]

Recommended fixes: [ordered by severity]
Next step: /build-module to address findings
