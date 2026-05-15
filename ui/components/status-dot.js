/**
 * ProofPost V1.1 — Status Dot Component
 * ui/components/status-dot.js
 */

export class PPStatusDot extends HTMLElement {
  static get observedAttributes() {
    return ['status'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const status = this.getAttribute('status') || 'offline';
    // Remove existing status classes
    this.classList.remove('status-dot--online', 'status-dot--offline', 'status-green', 'status-amber', 'status-red');
    
    // Base class
    this.classList.add('status-dot');

    // Add specific status class
    if (status === 'online' || status === 'green') {
      this.classList.add('status-green');
    } else if (status === 'warning' || status === 'amber') {
      this.classList.add('status-amber');
    } else {
      this.classList.add('status-red');
    }
  }
}

customElements.define('pp-status-dot', PPStatusDot);
