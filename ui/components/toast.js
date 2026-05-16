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
      <div class="toast-content flex items-center justify-between gap-3 width-full">
        <span>${escapeHtml(message)}</span>
        <button type="button" class="btn btn--icon text-lg p-1 opacity-70 hover:opacity-100 cursor-pointer" title="Click to dismiss" aria-label="Close toast">×</button>
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
      // Add all new toasts
      for (let i = lastToastCount; i < toasts.length; i++) {
        const newToast = toasts[i];
        const toastEl = document.createElement('pp-toast');
        toastEl.setAttribute('type', newToast.type);
        toastEl.setAttribute('message', newToast.message);
        toastEl.setAttribute('persist', newToast.persist || 'false');
        container.appendChild(toastEl);
      }
    }
    lastToastCount = toasts.length;
  });
}
