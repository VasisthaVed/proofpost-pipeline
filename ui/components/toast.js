/**
 * ProofPost V1.1 — Toast Component & Manager
 * ui/components/toast.js
 */

import { escapeHtml } from '../utils.js';
import { subscribe } from '../store.js';

export class PPToast extends HTMLElement {
  connectedCallback() {
    this.render();
    
    const persist = this.getAttribute('persist') === 'true';
    
    if (!persist) {
      // Auto-remove after 3 seconds for non-persistent toasts
      setTimeout(() => {
        this.dismiss();
      }, 3000);
    }

    this.addEventListener('click', () => this.dismiss());
  }

  dismiss() {
    if (this._dismissing) return;
    this._dismissing = true;
    this.classList.add('fade-out');
    setTimeout(() => this.remove(), 300);
  }

  render() {
    const type = this.getAttribute('type') || 'info';
    const message = this.getAttribute('message') || '';
    
    this.className = `toast toast--${escapeHtml(type)}`;
    this.innerHTML = `
      <div class="toast-content">
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }
}

customElements.define('pp-toast', PPToast);

/**
 * Toast Manager
 * Subscribes to the store and renders toasts.
 */
let lastToastCount = 0;

export function initToastManager() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);

  subscribe((state) => {
    const toasts = state.ui.toastQueue;
    if (toasts.length > lastToastCount) {
      // New toast added
      const newToast = toasts[toasts.length - 1];
      const toastEl = document.createElement('pp-toast');
      toastEl.setAttribute('type', newToast.type);
      toastEl.setAttribute('message', newToast.message);
      toastEl.setAttribute('persist', newToast.persist || 'false');
      container.appendChild(toastEl);
    }
    lastToastCount = toasts.length;
  });
}
