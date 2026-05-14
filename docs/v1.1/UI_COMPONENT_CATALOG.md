# ProofPost — UI Component Catalog
# docs/v1.1/UI_COMPONENT_CATALOG.md

---

# PURPOSE

Defines all approved Web Components in ProofPost V1.1.

Goals:
- prevent component sprawl
- prevent responsibility drift
- standardize behavior
- enforce accessibility

Components are display units only.

They:
- receive data
- render data
- emit events

They NEVER:
- fetch data
- mutate store
- contain business logic

---

# COMPONENT RULES

All components:
- extend HTMLElement
- render into light DOM only (Shadow DOM is forbidden in V1.1)
- use CustomEvents only
- support dark/light themes
- render gracefully with missing data
- use tokens.css variables only

---

# APPROVED COMPONENTS

---

# pp-status-dot

Purpose:
display runtime status visually.

Attributes:
```html
status="online|offline|warning"
label="Backend"
```

Events:
none

Forbidden:

* polling
* API calls

---

# pp-fact-card

Purpose:
render pending fact summary.

Attributes:

```html
summary=""
confidence=""
type=""
timestamp=""
```

Events:

```text
pp-select
pp-approve
pp-reject
```

Forbidden:

* dispatch logic
* rendering platform previews

---

# pp-platform-card

Purpose:
render platform health and status.

Attributes:

```html
platform="bluesky"
connected="true"
status="healthy"
```

Events:

```text
pp-test-platform
```

---

# pp-toast

Purpose:
temporary user feedback.

Variants:

* success
* error
* warning
* info

Forbidden:

* persistence
* logging

---

# pp-modal

Purpose:
generic modal container.

Responsibilities:

* focus trapping
* keyboard escape
* overlay rendering

Forbidden:

* business logic

---

# pp-loading

Purpose:
render loading skeletons.

Modes:

* card
* list
* workspace

---

# pp-empty-state

Purpose:
render intentional empty states.

Attributes:

```html
title=""
message=""
action=""
```

---

# ACCESSIBILITY RULES

All components must:

* support keyboard navigation
* expose ARIA labels
* support focus outlines
* preserve contrast ratios
* avoid motion-only feedback

---

# COMPONENT DATA PASSING

All components must:
- use property setters for complex objects (e.g. component.data = fact)
- NEVER use serialized JSON attributes for data passing

---

# EVENT RULES

Components emit UP only.

VALID:

```javascript
dispatchEvent(new CustomEvent())
```

INVALID:

```javascript
store.update()
fetch()
router.navigate()
```

---

# FUTURE COMPONENTS REQUIRE REVIEW

New components require:

* justification
* responsibility definition
* event contract
* accessibility review
