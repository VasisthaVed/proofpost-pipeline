# Workflow: add-platform
# Trigger: /add-platform
# Use this when adding a new platform adapter (Reddit, Bluesky, etc.)

## Steps

1. Read platforms/base.py to understand the base adapter interface
2. Confirm the platform has these 3 methods: authenticate(), generate_payload(), dispatch()
3. Read core/config.py to understand how credentials are loaded for this platform
4. Write the adapter in platforms/[platform_name].py
5. Each method must:
   - Take only what it needs (no global state)
   - Return {"success": bool, "url": str or None, "error": str or None}
   - Log all actions with structlog
   - Handle rate limits explicitly (log + return error, do not raise)
6. Write tests in tests/test_[platform_name].py using mocked HTTP calls (httpx mock)
7. Add the platform ID to the platforms list in core/config.py
8. Output: platform name, methods written, tests written, credentials required

## NEVER
- Make real HTTP calls in tests — always mock
- Access the database from a platform adapter
- Store credentials inside the adapter — load from config only
