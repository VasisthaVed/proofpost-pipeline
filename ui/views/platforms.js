/**
 * ProofPost V1.1 — Platforms View
 * ui/views/platforms.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let viewError = null;

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
    render(container, store);
    onActivate();
  });

  container.querySelector('#btn-refresh-platforms')?.addEventListener('click', async () => {
    actions.setLoading(true);
    const res = await api.getPlatforms();
    actions.setLoading(false);
    if (res.success) {
      actions.setPlatforms(res.data.platforms || []);
    }
  });

  container.addEventListener('pp-test', async (e) => {
    const id = e.detail.id;
    actions.addToast({ type: 'info', message: `Testing ${id} connection...` });
    const res = await api.testPlatform(id);
    if (res.success) {
      actions.addToast({ type: 'success', message: `${id} connection healthy.` });
    } else {
      actions.addToast({ type: 'error', message: `${id} connection failed: ${res.error.message}` });
    }
  });

  container.addEventListener('pp-connect', (e) => {
    actions.addToast({ type: 'info', message: 'Platform setup required in settings.' });
    window.dispatchEvent(new CustomEvent('navigate', { detail: '/settings' }));
  });
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  if (store.platforms.items.length === 0) {
    actions.setLoading(true);
    const res = await api.getPlatforms();
    actions.setLoading(false);
    if (res.success) {
      actions.setPlatforms(res.data.platforms || []);
      viewError = null;
    } else {
      viewError = res.error?.message || 'Failed to connect to platforms API.';
      const container = document.getElementById('view-container');
      if (container) render(container, store);
    }
  }

  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/platforms') {
      render(container, state);
    }
  });
}

export function onDeactivate() {
  
  if (unsubscribe) unsubscribe();
}
