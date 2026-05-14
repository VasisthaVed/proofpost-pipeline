# ProofPost — Platform Rendering Specification
# docs/v1.1/PLATFORM_RENDERING_SPEC.md

---

# PURPOSE

Defines how verified facts transform into platform-specific posts.

Goals:
- preserve factual integrity
- respect platform culture
- avoid robotic cross-posting
- standardize rendering pipeline

One fact should NOT render identically everywhere.

---

# RENDERING PIPELINE

```text
VerifiedBuildFact
→ Platform Formatter
→ Constraint Engine
→ Preview Renderer
→ Dispatch Payload
```

Each stage is deterministic and inspectable.

---

# CORE PRINCIPLE

Verification remains constant.

Presentation changes per platform.

Meaning:

* the verified fact does not change
* wording and formatting may adapt

---

# PLATFORM IDENTITY

---

# BLUESKY

Purpose:
fast engineering updates

Style:

* concise
* technical
* lightweight

Tone:
builder-oriented

Constraints:

* short-form preferred
* avoid long introductions
* avoid corporate tone

Allowed:

* hashtags
* technical shorthand

Avoid:

* excessive emojis
* marketing speak

Example:

```text
Implemented JWT-based auth recovery flow and fixed duplicate dispatch retries.
```

---

# LINKEDIN

Purpose:
professional engineering narrative

Style:

* slightly expanded
* implementation focused
* outcome aware

Structure:

```text
problem
→ implementation
→ operational impact
```

Avoid:

* clickbait founder tone
* hype language

Example:

```text
Implemented a deterministic approval boundary to prevent duplicate dispatches during recovery scenarios.
```

---

# REDDIT (V2)

Purpose:
discussion-oriented explanation

Style:

* conversational
* contextual
* explanatory

Requires:

* subreddit-aware formatting

---

# GITHUB RELEASE NOTES (V2)

Purpose:
technical changelog

Style:

* structured
* bullet-oriented
* implementation precise

---

# RENDERING RULES

Renderers MAY:

* shorten text
* expand context
* alter formatting
* adjust hashtags

Renderers MUST NOT:

* invent unsupported claims
* change technical meaning
* fabricate metrics

---

# CHARACTER MANAGEMENT

If platform limit exceeded:

Priority order:

```text
1. remove hashtags
2. shorten intro
3. compress wording
4. thread fallback (future)
```

Never truncate:

* technical meaning
* verification-critical terms

---

# HASHTAG RULES

Bluesky:
light hashtags allowed.

LinkedIn:
minimal hashtags preferred.

Future:
platform-specific hashtag engines.

---

# MEDIA SUPPORT

Reserved for V2:

* screenshots
* diagrams
* code snippets
* generated thumbnails

---

# HUMAN EDIT RULES

Operators MAY:

* refine tone
* improve readability
* shorten text

Operators MUST NOT:

* alter verified meaning
* add unsupported claims

---

# VERIFICATION INTEGRITY

Workspace always displays:

```text
verified source
≠ rendered presentation
```

This distinction is critical.

---

# FUTURE RENDERER STRUCTURE

```text
renderers/
  bluesky_renderer.py
  linkedin_renderer.py
  reddit_renderer.py
```

---

# V2 EXTENSIONS

Reserved:

* thread generation
* release narratives
* semantic grouping
* audience adaptation
* scheduling intelligence
