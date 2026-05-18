/**
 * ProofPost V1.1 — Dashboard View
 * ui/views/dashboard.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let pollInterval = null;
let isLoading = false;
let viewError = null;
let unsubscribe = null;
let dashSigLast = '';
let onConfigChangedHandler = null;

function dashboardRenderSignature(state) {
  if (state.app.route !== '/dashboard') return null;
  return JSON.stringify({
    api_online: state.app.api_online,
    last_health_check: state.app.last_health_check,
    pendingFacts: state.workspace.facts.length,
    platforms: state.platforms.items,
    historyLen: state.history.items.length,
    dry_run: state.settings.dry_run,
    dev_mode: state.settings.dev_mode,
    ngrok_status: state.app.ngrok_status,
    viewError
  });
}

/**
 * Render the dashboard view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const pendingCount = state.workspace.facts.length;
  const health = state.app.api_online ? 'Operational' : 'Disconnected';
  const historyCount = state.history.items.length;

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>System Dashboard</h1>
          <p class="text-secondary">Global overview of pipeline health and publication workload.</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--outline" id="btn-refresh-dash">Refresh Data</button>
        </div>
      </div>

      <div class="view-content">
        ${viewError ? `
          <div class="card p-12 text-center flex flex-col items-center gap-6">
            <div class="text-4xl">⚠️</div>
            <div>
              <h2 class="mb-2">Dashboard Sync Failed</h2>
              <p class="text-secondary text-sm">${escapeHtml(viewError)}</p>
            </div>
            <button class="btn btn--primary" id="btn-retry-dash">
              Retry Connection
            </button>
          </div>
        ` : `
        <div class="grid grid--3 mb-8">
          <!-- System Health -->
          <div class="card p-6 flex flex-col justify-between">
            <div>
              <span class="label">System Health</span>
              <div class="flex items-center gap-2 mt-2">
                <pp-status-dot status="${state.app.api_online ? 'online' : 'offline'}"></pp-status-dot>
                <h2 class="m-0">${escapeHtml(health)}</h2>
              </div>
            </div>
            <div class="mt-4 text-xs text-muted">
              Last heartbeat: ${state.app.last_health_check
    ? new Date(state.app.last_health_check).toLocaleTimeString()
    : '—'}
            </div>
          </div>

          <!-- Publication Queue -->
          <div class="card p-6 flex flex-col justify-between ${pendingCount === 0 ? 'bg-success-subtle' : ''}">
            <div>
              <span class="label">Pending Review</span>
              <div class="flex items-center gap-2 mt-2">
                ${pendingCount === 0 ? `
                  <span class="text-xl">🎉</span>
                  <h2 class="m-0 text-success">Inbox Zero</h2>
                ` : `
                  <h2 class="m-0">${pendingCount}</h2>
                  <span class="text-secondary text-sm">facts awaiting approval</span>
                `}
              </div>
            </div>
            <div class="mt-4">
              <button class="btn ${pendingCount === 0 ? 'btn--outline' : 'btn--primary'} btn--sm w-full" id="btn-goto-workspace">
                ${pendingCount === 0 ? 'View Archive' : 'Open Workspace'}
              </button>
            </div>
          </div>

          <!-- History Stats -->
          <div class="card p-6 flex flex-col justify-between">
            ${isLoading ? `
              <pp-loading type="skeleton" rows="2"></pp-loading>
            ` : `
              <div>
                <span class="label">Total Published</span>
                <div class="flex items-center gap-2 mt-2">
                  <h2 class="m-0">${historyCount}</h2>
                  <span class="text-secondary text-sm">posts across all platforms</span>
                </div>
              </div>
              <div class="mt-4">
                <button class="btn btn--ghost btn--sm w-full" data-route="/history">View History</button>
              </div>
            `}
          </div>
        </div>

        <div class="grid" style="grid-template-columns: 2fr 1fr;">
          <!-- Recent Activity / Platforms -->
          <div class="card overflow-hidden">
            <div class="p-4 border-b bg-raised flex justify-between items-center">
              <h3 class="m-0">Active Platforms</h3>
              <button class="btn btn--ghost btn--sm" data-route="/platforms">Manage</button>
            </div>
            <div class="p-0">
              <div id="dash-platforms-list">
                <pp-loading type="skeleton" rows="2" class="p-6"></pp-loading>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-6">
            <div class="card overflow-hidden">
              <div class="p-4 border-b bg-raised">
                <h3 class="m-0">System Info</h3>
              </div>
              <div class="p-6">
                <div class="flex flex-col gap-4">
                  <div>
                    <span class="label">Version</span>
                    <div class="text-sm font-mono">v1.1.1-stable</div>
                  </div>
                  <div>
                    <span class="label">Environment</span>
                    <div class="badge badge--info">${state.settings.dev_mode ? 'Development' : 'Production'}</div>
                  </div>
                  <div>
                    <span class="label">Safety Gate</span>
                    <div class="badge badge--${state.settings.dry_run ? 'warning' : 'success'}">${state.settings.dry_run ? 'Dry Run Active' : 'Live Publishing'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card overflow-hidden">
              <div class="p-4 border-b bg-raised flex justify-between items-center">
                <h3 class="m-0">Webhook Tunnel</h3>
                <pp-status-dot status="${state.app.ngrok_status?.connected ? 'online' : 'offline'}"></pp-status-dot>
              </div>
              <div class="p-6">
                ${state.app.ngrok_status?.connected && state.app.ngrok_status?.public_url ? `
                  <div class="flex flex-col gap-2">
                    <span class="label">GitHub Webhook URL</span>
                    <div class="p-2 bg-raised rounded font-mono text-xs break-all border border-subtle select-all">
                      ${escapeHtml(state.app.ngrok_status.public_url)}/webhook/github
                    </div>
                    <span class="text-xs text-success mt-1">✓ Active forwarding tunnel detected</span>
                  </div>
                ` : `
                  <div class="flex flex-col gap-2">
                    <span class="label">Status</span>
                    <div class="text-sm text-secondary font-medium">No active ngrok tunnel detected</div>
                    <div class="text-xs text-muted mt-1">Run <code class="mono bg-raised px-1 rounded text-xs">ngrok http 7821</code> in your terminal to receive GitHub webhooks.</div>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
        `}
      </div>
    </div>
  `;

  renderPlatformStatus(container, state);

  // Attach local listeners
  container.querySelector('#btn-goto-workspace')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: '/workspace' }));
  });

  container.querySelector('#btn-refresh-dash')?.addEventListener('click', refreshData);
  container.querySelector('#btn-retry-dash')?.addEventListener('click', refreshData);
  
  container.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: el.getAttribute('data-route') }));
    });
  });
}

function renderPlatformStatus(container, state) {
  const list = container.querySelector('#dash-platforms-list');
  if (!list) return;

  const platforms = state.platforms.items;
  if (platforms.length === 0) {
    list.innerHTML = `<div class="p-6 text-center text-muted text-sm">No platforms configured.</div>`;
    return;
  }

  list.innerHTML = platforms.map(p => `
    <div class="flex items-center justify-between p-4 border-b last:border-0">
      <div class="flex items-center gap-3">
        <span class="text-lg">${p.id === 'linkedin' ? '🔗' : '🦋'}</span>
        <div>
          <div class="font-semibold text-sm">${escapeHtml(p.name)}</div>
          <div class="text-xs text-muted truncate" style="max-width: 150px;">${escapeHtml(p.handle || 'Not connected')}</div>
        </div>
      </div>
      <pp-status-dot status="${p.connected ? 'online' : 'offline'}"></pp-status-dot>
    </div>
  `).join('');
}

/**
 * Activate view: Start health polling
 */
export async function onActivate() {
  isLoading = true;
  const container = document.getElementById('view-container');
  
  dashSigLast = '';
  unsubscribe = subscribe((state) => {
    const el = document.getElementById('view-container');
    if (!el || state.app.route !== '/dashboard') return;
    const sig = dashboardRenderSignature(state);
    if (sig == null) return;
    if (sig === dashSigLast) return;
    dashSigLast = sig;
    render(el, state);
  });

  onConfigChangedHandler = () => {
    if (store.app.route === '/dashboard') refreshData();
  };
  window.addEventListener('pp-config-changed', onConfigChangedHandler);

  if (container) render(container, store);

  // Initial fetch - skip if already hydrated by app boot
  if (!store.app.server_hydrated) {
    await refreshData();
  }
  isLoading = false;
  
  // Start polling every 15s
  pollInterval = setInterval(refreshData, 15000);
}

/**
 * Deactivate view: Clear polling
 */
export function onDeactivate() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  if (onConfigChangedHandler) {
    window.removeEventListener('pp-config-changed', onConfigChangedHandler);
    onConfigChangedHandler = null;
  }
}

/**
 * Fetch fresh health and facts
 */
async function refreshData() {
  viewError = null;
  const container = document.getElementById('view-container');
  try {
    const factsRes = await api.getPendingFacts();
    if (factsRes.success) {
      actions.setPendingFacts(factsRes.data.items || []);
    }

    const platformsRes = await api.getPlatforms();
    if (platformsRes.success) {
      actions.setPlatforms(platformsRes.data.platforms || []);
    }

    const historyRes = await api.getHistory();
    if (historyRes.success) {
      actions.setHistoryItems(historyRes.data.items || []);
    }
  } catch (err) {
    viewError = err.message;
    if (container) render(container, store);
  }
}
