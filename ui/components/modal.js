/**
 * ProofPost V1.1 — Modal Component
 * ui/components/modal.js
 */

export class PPModal extends HTMLElement {
  constructor() {
    super();
    this._isOpen = false;
  }

  set open(val) {
    this._isOpen = Boolean(val);
    this.render();
    if (this._isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  connectedCallback() {
    this.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.dispatchEvent(new CustomEvent('pp-close', { bubbles: true }));
      }
    });
  }

  render() {
    if (!this._isOpen) {
      this.innerHTML = '';
      return;
    }

    const title = this.getAttribute('title') || '';
    
    this.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-container card card--raised" role="dialog" aria-modal="true">
          <header class="modal-header">
            <h3>${title}</h3>
            <button class="btn btn--ghost p-2" id="btn-modal-close">✕</button>
          </header>
          <div class="modal-body">
            <slot></slot>
          </div>
          <div class="modal-footer" id="modal-actions">
            <!-- Buttons injected here -->
          </div>
        </div>
      </div>
    `;

    this.querySelector('#btn-modal-close').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-close', { bubbles: true }));
    });
  }
}

customElements.define('pp-modal', PPModal);
