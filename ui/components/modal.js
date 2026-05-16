/**
 * ProofPost V1.1 — Modal Component
 * ui/components/modal.js
 */

export class PPModal extends HTMLElement {
  constructor() {
    super();
    this._isOpen = false;
    this._title = '';
    this._bodyText = '';
    this._bodyIsPre = false;
    this._confirmLabel = 'Confirm';
    this._hideCancel = false;
  }

  set open(val) {
    this._isOpen = Boolean(val);
    this.render();
    document.body.style.overflow = this._isOpen ? 'hidden' : '';
  }

  set modalTitle(val) { this._title = val || ''; }
  set bodyText(val) { this._bodyText = val || ''; }
  set bodyIsPre(val) { this._bodyIsPre = Boolean(val); }
  set confirmLabel(val) { this._confirmLabel = val || 'Confirm'; }
  set hideCancel(val) { this._hideCancel = Boolean(val); }

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

    const escapedBody = escapeHtml(this._bodyText);
    const bodyHtml = this._bodyIsPre 
      ? `<pre class="mono text-xs" style="max-height:55vh;overflow:auto;white-space:pre-wrap">${escapedBody}</pre>`
      : `<p class="text-secondary">${escapedBody}</p>`;

    const footerHtml = this._hideCancel
      ? `<button class="btn btn--primary" id="modal-confirm">${escapeHtml(this._confirmLabel)}</button>`
      : `<button class="btn btn--ghost" id="modal-cancel">Cancel</button>
         <button class="btn btn--primary" id="modal-confirm">${escapeHtml(this._confirmLabel)}</button>`;

    this.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-container card card--raised" role="dialog" aria-modal="true">
          <header class="modal-header">
            <h3>${escapeHtml(this._title)}</h3>
            <button class="btn btn--ghost p-2" id="btn-modal-close">✕</button>
          </header>
          <div class="modal-body">
            ${bodyHtml}
          </div>
          <div class="modal-footer" id="modal-actions">
            ${footerHtml}
          </div>
        </div>
      </div>
    `;

    this.querySelector('#btn-modal-close')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-close', { bubbles: true }));
    });
    this.querySelector('#modal-cancel')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-close', { bubbles: true }));
    });
    this.querySelector('#modal-confirm')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-confirm', { bubbles: true }));
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

customElements.define('pp-modal', PPModal);
