/**
 * ProofPost V1.1 — Platform Card Component
 * ui/components/platform-card.js
 */

import { escapeHtml } from '../utils.js';

export class PPPlatformCard extends HTMLElement {
  constructor() {
    super();
    this._platform = null;
    this._isConnecting = false;
    this._onHostClick = this._onHostClick.bind(this);
  }

  set platform(val) {
    this._platform = val;
    this._isConnecting = false;
    this.render();
  }

  connectedCallback() {
    if (!this._delegationBound) {
      this._delegationBound = true;
      this.addEventListener('click', this._onHostClick);
    }
    if (this._platform) this.render();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onHostClick);
    this._delegationBound = false;
  }

  _onHostClick(e) {
    if (!this._platform) return;
    const id = this._platform.id;
    if (e.target.closest('#btn-test')) {
      this.dispatchEvent(new CustomEvent('pp-test', { detail: { id }, bubbles: true }));
    }
    if (e.target.closest('#btn-connect')) {
      this._isConnecting = true;
      this.render();
    }
    if (e.target.closest('#btn-cancel-connect')) {
      this._isConnecting = false;
      this.render();
    }
    if (e.target.closest('#btn-save-connect')) {
      if (id === 'bluesky') {
        const handle = this.querySelector('#input-bsky-handle')?.value?.trim() || '';
        const app_password = this.querySelector('#input-bsky-password')?.value?.trim() || '';
        if (!handle || !app_password) {
          this.dispatchEvent(new CustomEvent('pp-error', { detail: { message: 'Both Handle and App Password are required.' }, bubbles: true }));
          return;
        }
        this.dispatchEvent(new CustomEvent('pp-save-connect', { detail: { id, handle, app_password }, bubbles: true }));
      } else if (id === 'linkedin') {
        const access_token = this.querySelector('#input-li-token')?.value?.trim() || '';
        if (!access_token) {
          this.dispatchEvent(new CustomEvent('pp-error', { detail: { message: 'Access Token is required.' }, bubbles: true }));
          return;
        }
        this.dispatchEvent(new CustomEvent('pp-save-connect', { detail: { id, access_token }, bubbles: true }));
      }
    }
    if (e.target.closest('#btn-disconnect')) {
      this.dispatchEvent(new CustomEvent('pp-disconnect', { detail: { id }, bubbles: true }));
    }
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
        ` : this._isConnecting ? `
          <div class="flex flex-col gap-3 mt-2 w-full text-left">
            ${p.id === 'bluesky' ? `
              <div class="form-group">
                <label class="label text-xs">Bluesky Handle</label>
                <input type="text" class="input input--sm w-full" id="input-bsky-handle" placeholder="e.g. user.bsky.social" value="${escapeHtml(p.handle || '')}">
              </div>
              <div class="form-group">
                <label class="label text-xs">App Password</label>
                <input type="password" class="input input--sm w-full" id="input-bsky-password" placeholder="xxxx-xxxx-xxxx-xxxx">
                <p class="text-xs text-muted mt-1">App passwords are encrypted at rest.</p>
              </div>
            ` : `
              <div class="form-group">
                <label class="label text-xs">LinkedIn Access Token</label>
                <input type="password" class="input input--sm w-full" id="input-li-token" placeholder="Enter OAuth access token">
                <p class="text-xs text-muted mt-1">Access tokens are encrypted at rest.</p>
              </div>
            `}
          </div>
        ` : `
          <p class="text-sm text-secondary">Connection required to begin publishing.</p>
        `}
      </div>

      <div class="platform-actions flex gap-2">
        ${isConnected ? `
          <button type="button" class="btn btn--outline btn--sm" id="btn-test">Test Signal</button>
          <button type="button" class="btn btn--ghost btn--sm text-red" id="btn-disconnect">Disconnect</button>
        ` : this._isConnecting ? `
          <button type="button" class="btn btn--primary btn--sm" id="btn-save-connect">Save & Connect</button>
          <button type="button" class="btn btn--ghost btn--sm" id="btn-cancel-connect">Cancel</button>
        ` : `
          <button type="button" class="btn btn--primary btn--sm" id="btn-connect">Connect Account</button>
        `}
      </div>
    `;
  }
}

customElements.define('pp-platform-card', PPPlatformCard);
