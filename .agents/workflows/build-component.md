---
description: 
---

# Workflow: build-component
# Trigger: /build-component
# Use when building a new Web Component in ui/components/

## MANDATORY CONTEXT LOAD

Read these files first:
1. docs/governance/constitution.md
2. docs/v1.1/UI_ENGINEERING_RULES.md
3. ui/tokens.css — design tokens available

Confirm with: "Constitution read. UI rules read. Ready."

---

## SCOPE DECLARATION

ALLOWED:
- ui/components/pp-[name].js (create)

FORBIDDEN:
- ui/store.js
- ui/api.js
- ui/router.js
- Any view file
- Any backend file
- Adding new CSS tokens

---

## COMPONENT RULES (HARD)

Components are display units ONLY.
They receive data. They show data. They emit events.
They do NOT:
- Fetch data
- Mutate store
- Contain business logic
- Know about routes
- Know about other components

---

## ALLOWED COMPONENT LIST

Only these components exist in V1.1:
- pp-status-dot
- pp-fact-card
- pp-platform-card
- pp-toast
- pp-modal
- pp-loading
- pp-empty-state

Adding a new component requires explicit justification.
If in doubt: it should be HTML in the view, not a component.

---

## COMPONENT STRUCTURE

```javascript
class PpComponentName extends HTMLElement {
  // Observed attributes for data binding
  static get observedAttributes() {
    return ['status', 'label'] // whatever this component needs
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback() {
    this.render()
  }

  render() {
    // Build DOM from attributes
    // Use textContent for text — never innerHTML with external data
    // Use CSS variables for colors — never hardcoded hex
  }

  // Emit events UP — never call external functions
  emitApprove(id) {
    this.dispatchEvent(new CustomEvent('pp-approve', {
      bubbles: true,
      detail: { id }
    }))
  }
}

customElements.define('pp-component-name', PpComponentName)
```

---

## DEFINITION OF DONE

- [ ] Component extends HTMLElement
- [ ] Registered with customElements.define
- [ ] Communicates up via CustomEvents only
- [ ] No fetch() calls
- [ ] No store mutations
- [ ] No hardcoded colors
- [ ] No inline styles
- [ ] Works in dark and light theme
- [ ] Renders correctly with no attributes (graceful defaults)

---

## SESSION SUMMARY FORMAT

COMPONENT BUILT: [name]
ATTRIBUTES: [list]
EVENTS EMITTED: [list]
FORBIDDEN VIOLATIONS: NONE or [list]
DEFINITION OF DONE: PASS or [what is missing]