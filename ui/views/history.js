/**
 * ProofPost V1.1 — History View
 * ui/views/history.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let isLoading = false;
let viewError = null;

/**
 * Render the History view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const items = state.history.items || [];

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>Dispatch History</h1>
          <p class="text-secondary">Comprehensive archive of all approved facts and their publication status.</p>
        </div>
        <div class="view-header__actions flex gap-2">
          <select class="input input--sm" id="filter-platform">
            <option value="all">All Platforms</option>
            <option value="bluesky" ${state.history.filters.platform === 'bluesky' ? 'selected' : ''}>Bluesky</option>
            <option value="linkedin" ${state.history.filters.platform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
          </select>
          <select class="input input--sm" id="filter-status">
            <option value="all">All Statuses</option>
            <option value="dispatched" ${state.history.filters.status === 'dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="failed" ${state.history.filters.status === 'failed' ? 'selected' : ''}>Failed</option>
          </select>
          <button class="btn btn--outline btn--sm" id="btn-export-history">Export CSV</button>
        </div>
      </div>

      <div class="view-content">
        ${viewError ? `
          <div class="card p-12 text-center flex flex-col items-center gap-6">
            <div class="text-4xl">⚠️</div>
            <div>
              <h2 class="mb-2">History Sync Failed</h2>
              <p class="text-secondary text-sm">${escapeHtml(viewError)}</p>
            </div>
            <button class="btn btn--primary" id="btn-retry-history">
              Retry Connection
            </button>
          </div>
        ` : `
          <div class="card overflow-hidden">
          ${isLoading ? `
            <div class="p-8 space-y-6">
              <pp-loading type="skeleton" rows="5"></pp-loading>
              <pp-loading type="skeleton" rows="5"></pp-loading>
              <pp-loading type="skeleton" rows="5"></pp-loading>
            </div>
          ` : items.length === 0 ? `
            <pp-empty-state 
              icon="📜" 
              title="No History" 
              description="Your publication history will appear here once you approve and dispatch facts in the Workspace.">
            </pp-empty-state>
          ` : `
            <table class="w-full text-left table-history">
              <thead class="bg-raised border-b">
                <tr>
                  <th class="p-4 text-xs uppercase text-muted font-bold">Timestamp</th>
                  <th class="p-4 text-xs uppercase text-muted font-bold">Platform</th>
                  <th class="p-4 text-xs uppercase text-muted font-bold">Content Summary</th>
                  <th class="p-4 text-xs uppercase text-muted font-bold">Status</th>
                  <th class="p-4 text-xs uppercase text-muted font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${items
      .filter(item => (state.history.filters.platform === 'all' || item.platform === state.history.filters.platform) &&
                      (state.history.filters.status === 'all' || item.status === state.history.filters.status))
      .map(item => `
                  <tr class="border-b border-subtle hover:bg-raised transition-colors">
                    <td class="p-4">
                      <div class="text-sm font-medium">${new Date(item.created_at).toLocaleDateString()}</div>
                      <div class="text-xs text-muted mono">${new Date(item.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <div class="flex -space-x-1">
                          ${item.platform.toLowerCase().includes('bluesky') ? '<span class="text-lg" title="Bluesky">🦋</span>' : ''}
                          ${item.platform.toLowerCase().includes('linkedin') ? '<span class="text-lg" title="LinkedIn">🔗</span>' : ''}
                        </div>
                        <span class="text-sm font-semibold">${item.platform.split(', ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</span>
                      </div>
                    </td>
                    <td class="p-4">
                      <p class="text-sm text-secondary m-0 text-truncate-wide">
                        ${escapeHtml(item.summary)}
                      </p>
                    </td>
                    <td class="p-4">
                      <div class="flex flex-col gap-1">
                        <span class="badge badge--${item.status === 'failed' ? 'error' : 'success'}">${escapeHtml(item.status || 'Dispatched')}</span>
                        ${item.status === 'failed' && item.error ? `<div class="text-[10px] text-red opacity-80 leading-tight" style="max-width: 150px;">${escapeHtml(item.error)}</div>` : ''}
                      </div>
                    </td>
                    <td class="p-4 text-right">
                      ${item.url ? `
                        <a href="${item.url}" target="_blank" class="btn btn--ghost btn--sm p-1">View Post</a>
                      ` : `
                        <button class="btn btn--ghost btn--sm p-1" disabled>No URL</button>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
        `}
      </div>
    </div>
  `;

  attachListeners(container);
}

function attachListeners(container) {
  container.querySelector('#btn-retry-history')?.addEventListener('click', () => {
    viewError = null;
    onActivate();
  });

  container.querySelector('#filter-platform')?.addEventListener('change', (e) => {
    actions.setHistoryFilters({ platform: e.target.value });
  });

  container.querySelector('#filter-status')?.addEventListener('change', (e) => {
    actions.setHistoryFilters({ status: e.target.value });
  });

  container.querySelector('#btn-export-history')?.addEventListener('click', () => {
    actions.addToast({ type: 'info', message: 'CSV Export is not yet implemented in V1.1.' });
  });
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  isLoading = true;
  const container = document.getElementById('view-container');
  if (container) render(container, store);

  const res = await api.getHistory();
  isLoading = false;

  if (res.success) {
    const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
    actions.setHistoryItems(items);
    viewError = null;
  } else {
    actions.setHistoryItems([]);
    viewError = res.error?.message || 'Failed to fetch history archive.';
    if (container) render(container, store);
  }

  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/history') {
      render(container, state);
    }
  });
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
}
