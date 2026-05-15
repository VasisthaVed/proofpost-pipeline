/**
 * ProofPost V1.1 — Platform Card Component
 * ui/components/platform-card.js
 */

import { escapeHtml } from '../utils.js';

export class PPPlatformCard extends HTMLElement {
  constructor() {
    super();
    this._platform = null;
  }

  set platform(val) {
    this._platform = val;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this._platform) return;

    const p = this._platform;
    const isConnected = p.connected;
    
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', `${p.name} connection status`);
    this.className = `platform-card card ${isConnected ? '' : 'platform-card--disconnected'}`;

    this.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <span class="platform-icon" aria-hidden="true">${p.icon || '🌐'}</span>
          <div>
            <h3 class="font-bold text-md m-0">${escapeHtml(p.name)}</h3>
            <p class="text-xs text-muted m-0">${escapeHtml(p.type || 'Adapter')}</p>
          </div>
        </div>
        <pp-status-dot status="${isConnected ? 'online' : 'offline'}" aria-label="${isConnected ? 'Online' : 'Offline'}"></pp-status-dot>
      </div>
      
      <div class="platform-details mb-6">
        ${isConnected ? `
          <div class="text-sm">Connected as <span class="mono">${escapeHtml(p.handle || 'User')}</span></div>
          ${p.last_tested ? `<div class="text-xs text-muted mt-1">Last verified: ${new Date(p.last_tested).toLocaleTimeString()}</div>` : ''}
        ` : `
          <p class="text-sm text-secondary">Connection required to begin publishing.</p>
        `}
      </div>

      <div class="platform-actions flex gap-2">
        ${isConnected ? `
          <button class="btn btn--outline btn--sm" id="btn-test">Test Signal</button>
          <button class="btn btn--ghost btn--sm text-red" id="btn-disconnect">Disconnect</button>
        ` : `
          <button class="btn btn--primary btn--sm" id="btn-connect">Connect Account</button>
        `}
      </div>
    `;

    this.querySelector('#btn-test')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-test', { detail: { id: p.id }, bubbles: true }));
    });

    this.querySelector('#btn-connect')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('pp-connect', { detail: { id: p.id }, bubbles: true }));
    });
  }
}

customElements.define('pp-platform-card', PPPlatformCard);
