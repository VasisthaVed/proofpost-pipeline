/**
 * ProofPost V1.1 — Platforms View
 * ui/views/platforms.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let viewError = null;
let platformsSigLast = '';
let platformDelegatesAbort = null;

async function handlePpTest(e) {
  if (store.app.route !== '/platforms') return;
  const id = e.detail?.id;
  if (!id) return;
  actions.addToast({ type: 'info', message: `Testing ${id} connection...` });
  const res = await api.testPlatform(id);
  if (res.success) {
    actions.addToast({ type: 'success', message: `${id} connection healthy.` });
    const pr = await api.getPlatforms();
    if (pr.success) actions.setPlatforms(pr.data.platforms || []);
    const sr = await api.getSettings();
    if (sr.success) actions.updateSettings(sr.data);
    window.dispatchEvent(new CustomEvent('pp-config-changed'));
  } else {
    actions.addToast({ type: 'error', message: `${id} connection failed: ${res.error.message}` });
  }
}

function handlePpConnect() {
  if (store.app.route !== '/platforms') return;
  actions.addToast({ type: 'info', message: 'Configure Bluesky or LinkedIn in Settings, then Save Changes.' });
  window.dispatchEvent(
    new CustomEvent('navigate', { detail: { path: '/settings', settingsTab: 'platforms' } })
  );
}

async function handlePpSaveConnect(e) {
  if (store.app.route !== '/platforms') return;
  const { id, handle, app_password, access_token } = e.detail || {};
  if (!id) return;

  actions.addToast({ type: 'info', message: `Connecting ${id}...` });
  actions.setLoading(true);

  let payload = {};
  if (id === 'bluesky') {
    payload = {
      platforms: {
        bluesky: { enabled: true, handle, app_password }
      }
    };
  } else if (id === 'linkedin') {
    payload = {
      platforms: {
        linkedin: { enabled: true, access_token }
      }
    };
  }

  const res = await api.saveSettings(payload);
  if (res.success) {
    actions.addToast({ type: 'success', message: `Successfully connected to ${id}.` });
    const pr = await api.getPlatforms();
    if (pr.success) actions.setPlatforms(pr.data.platforms || []);
    const sr = await api.getSettings();
    if (sr.success) actions.updateSettings(sr.data);
    window.dispatchEvent(new CustomEvent('pp-config-changed'));
  } else {
    actions.addToast({ type: 'error', message: `Failed to connect ${id}: ${res.error?.message || 'Unknown error'}` });
  }
  actions.setLoading(false);
}

async function handlePpDisconnect(e) {
  if (store.app.route !== '/platforms') return;
  const id = e.detail?.id;
  if (!id) return;

  if (!confirm(`Are you sure you want to disconnect ${id}?`)) return;

  actions.addToast({ type: 'info', message: `Disconnecting ${id}...` });
  actions.setLoading(true);

  let payload = {};
  if (id === 'bluesky') {
    payload = {
      platforms: {
        bluesky: { enabled: false, handle: '', app_password: '' }
      }
    };
  } else if (id === 'linkedin') {
    payload = {
      platforms: {
        linkedin: { enabled: false, access_token: '' }
      }
    };
  }

  const res = await api.saveSettings(payload);
  if (res.success) {
    actions.addToast({ type: 'success', message: `Disconnected ${id}.` });
    const pr = await api.getPlatforms();
    if (pr.success) actions.setPlatforms(pr.data.platforms || []);
    const sr = await api.getSettings();
    if (sr.success) actions.updateSettings(sr.data);
    window.dispatchEvent(new CustomEvent('pp-config-changed'));
  } else {
    actions.addToast({ type: 'error', message: `Failed to disconnect ${id}: ${res.error?.message || 'Unknown error'}` });
  }
  actions.setLoading(false);
}

function platformsRenderSignature(state) {
  if (state.app.route !== '/platforms') return null;
  return JSON.stringify({
    items: state.platforms.items,
    loading: state.app.loading,
    err: viewError
  });
}

/**
 * Render the Platforms view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const { platforms } = state;

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>Platform Connections</h1>
          <p class="text-secondary">Manage and test your publishing destinations across the decentralized web and professional networks.</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--outline" id="btn-refresh-platforms">Refresh Status</button>
        </div>
      </div>

      <div class="view-content">
        ${viewError ? `
          <div class="card p-12 text-center flex flex-col items-center gap-6">
            <div class="text-4xl">⚠️</div>
            <div>
              <h2 class="mb-2">Platform Discovery Failed</h2>
              <p class="text-secondary text-sm">${escapeHtml(viewError)}</p>
            </div>
            <button class="btn btn--primary" id="btn-retry-platforms">
              Retry Connection
            </button>
          </div>
        ` : `
          <div class="grid grid--3">
          ${platforms.items.length > 0 ? platforms.items.map(p => `
            <pp-platform-card id="platform-${p.id}"></pp-platform-card>
          `).join('') : ''}

          <!-- Empty State if no active platforms -->
          ${platforms.items.length === 0 ? `
            <div class="col-span-3">
              <pp-empty-state 
                icon="🔌" 
                title="No Platforms Connected" 
                description="Connect Bluesky to begin publishing your verified engineering activity to the world.">
              </pp-empty-state>
            </div>
          ` : ''}

          <!-- Coming Soon Placeholders -->
          <div class="card p-8 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
            <div class="text-3xl mb-4">🧵</div>
            <h3 class="text-sm font-bold mb-1">Threads</h3>
            <span class="badge badge--ghost">Coming Soon</span>
          </div>
          
          <div class="card p-8 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
            <div class="text-3xl mb-4">🐘</div>
            <h3 class="text-sm font-bold mb-1">Mastodon</h3>
            <span class="badge badge--ghost">Coming Soon</span>
          </div>

          <div class="card p-8 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
            <div class="text-3xl mb-4">👽</div>
            <h3 class="text-sm font-bold mb-1">Reddit</h3>
            <span class="badge badge--ghost">Coming Soon</span>
          </div>

          <div class="card p-8 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
            <div class="text-3xl mb-4">𝕏</div>
            <h3 class="text-sm font-bold mb-1">X / Twitter</h3>
            <span class="badge badge--ghost">Coming Soon</span>
          </div>
        </div>
        `}
      </div>
    </div>
  `;

  platforms.items.forEach(p => {
    const el = container.querySelector(`#platform-${p.id}`);
    if (el) el.platform = p;
  });

  attachListeners(container);
}

function attachListeners(container) {
  container.querySelector('#btn-retry-platforms')?.addEventListener('click', async () => {
    viewError = null;
    platformsSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
    actions.setLoading(true);
    const res = await api.getPlatforms();
    actions.setLoading(false);
    if (res.success) {
      actions.setPlatforms(res.data.platforms || []);
    } else {
      viewError = res.error?.message || 'Failed to connect to platforms API.';
    }
    const c2 = document.getElementById('view-container');
    if (c2) render(c2, store);
  });

  container.querySelector('#btn-refresh-platforms')?.addEventListener('click', async () => {
    actions.setLoading(true);
    const res = await api.getPlatforms();
    actions.setLoading(false);
    if (res.success) {
      actions.setPlatforms(res.data.platforms || []);
    }
  });
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  platformDelegatesAbort?.abort();
  platformDelegatesAbort = new AbortController();
  const { signal } = platformDelegatesAbort;
  const root = document.getElementById('view-container');
  root?.addEventListener('pp-test', handlePpTest, { signal });
  root?.addEventListener('pp-connect', handlePpConnect, { signal });
  root?.addEventListener('pp-save-connect', handlePpSaveConnect, { signal });
  root?.addEventListener('pp-disconnect', handlePpDisconnect, { signal });
  root?.addEventListener('pp-error', (e) => actions.addToast({ type: 'error', message: e.detail?.message }), { signal });

  platformsSigLast = '';
  unsubscribe = subscribe((state) => {
    const el = document.getElementById('view-container');
    if (!el || state.app.route !== '/platforms') return;
    const sig = platformsRenderSignature(state);
    if (sig == null) return;
    if (sig === platformsSigLast) return;
    platformsSigLast = sig;
    render(el, state);
  });

  viewError = null;
  actions.setLoading(true);
  let res = { success: true, data: { platforms: store.platforms.items } };
  if (!store.app.server_hydrated) {
    res = await api.getPlatforms();
  }
  actions.setLoading(false);
  if (res.success) {
    if (!store.app.server_hydrated) actions.setPlatforms(res.data.platforms || []);
    const container = document.getElementById('view-container');
    if (container) render(container, store);
  } else {
    viewError = res.error?.message || 'Failed to connect to platforms API.';
    const container = document.getElementById('view-container');
    if (container) render(container, store);
  }
}

export function onDeactivate() {
  platformDelegatesAbort?.abort();
  platformDelegatesAbort = null;
  if (unsubscribe) unsubscribe();
  platformsSigLast = '';
}
