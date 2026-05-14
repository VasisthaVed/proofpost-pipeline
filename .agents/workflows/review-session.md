# Workflow: review-session
# Trigger: /review-session
# Run this at the END of every coding session before committing

## Steps

1. List every file that was created or modified this session
2. For each file, check:
   - Does it have a module docstring?
   - Does every function have type hints?
   - Does every function have a docstring?
   - Are there any print() statements? (should be zero)
   - Are there any hardcoded API keys or secrets?
   - Are there any bare except: clauses without logging?
3. Check core/models.py — was it modified? If yes, flag it for manual review
4. Run through the 10 architecture rules in autopost-rules.md — any violations?
5. List what tests were added and confirm they cover the new code
6. Output a session summary:
   - Files created
   - Files modified  
   - Tests added
   - Any rule violations found
   - What the developer must manually verify before committing
