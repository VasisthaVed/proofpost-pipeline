/**
 * ProofPost V1.1 — Observability View
 * ui/views/observability.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let pollInterval = null;

/**
 * Render the Observability view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const events = state.observability.events || [];

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>Pipeline Telemetry</h1>
          <p class="text-secondary">Real-time trace of extraction, verification, and dispatch operations.</p>
        </div>
        <div class="view-header__actions">
          <div class="flex items-center gap-2">
            <pp-loading type="spinner" class="p-0" label="Live"></pp-loading>
            <button class="btn btn--outline btn--sm" id="btn-clear-logs">Clear View</button>
          </div>
        </div>
      </div>

      <div class="view-content">
        <div class="timeline-wrapper card overflow-hidden">
          <div class="timeline-header p-4 bg-raised border-b flex justify-between items-center">
            <span class="label">Event Log</span>
            <span class="text-xs text-muted">${events.length} events recorded</span>
          </div>
          
          <div class="timeline-body p-0">
            ${state.observability.endpointUnavailable ? `
              <pp-empty-state 
                icon="⚠️" 
                title="Telemetry Unavailable" 
                description="The observability endpoint (/api/events) is not implemented on the backend. Real-time operation traces are currently disabled.">
              </pp-empty-state>
            ` : events.length === 0 ? `
              <pp-empty-state 
                icon="📡" 
                title="Awaiting Telemetry" 
                description="No pipeline events have been recorded in the current session. Events will stream here in real-time.">
              </pp-empty-state>
            ` : `
              <div class="timeline">
                ${events.map((event, index) => renderEvent(event, index === 0)).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;

  attachListeners(container);
}

function attachListeners(container) {
  container.querySelector('#btn-clear-logs')?.addEventListener('click', () => {
    actions.clearObservabilityEvents();
  });
}

function renderEvent(event, isLatest) {
  const isError = event.status === 'error' || event.status === 'failed';
  const isWarning = event.status === 'warning' || event.status === 'partial';
  
  let dotStatus = 'online';
  if (isError) dotStatus = 'offline';
  else if (isWarning) dotStatus = 'warning';

  return `
    <div class="timeline-item ${isLatest ? 'timeline-item--latest' : ''}">
      <div class="timeline-marker">
        <pp-status-dot status="${dotStatus}"></pp-status-dot>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content p-4">
        <div class="flex justify-between items-start mb-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm capitalize">${escapeHtml(event.event_type.replace(/_/g, ' '))}</span>
            ${isLatest ? '<span class="badge badge--info" style="font-size: 9px;">Latest</span>' : ''}
            ${event.fact_id ? `<span class="badge badge--ghost" style="font-size: 9px;">Fact: ${escapeHtml(event.fact_id)}</span>` : ''}
          </div>
          <span class="text-xs text-muted mono">${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
        <p class="text-sm text-secondary m-0">${escapeHtml(event.detail || '')}</p>
        <div class="mt-2 flex items-center gap-4">
          <div class="text-[10px] text-muted mono uppercase">Trace: ${escapeHtml(event.session_id.substring(0, 8))}</div>
          ${event.duration_ms ? `<div class="text-[10px] text-muted mono uppercase">Duration: ${event.duration_ms}ms</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  
  
  await refreshEvents();
  pollInterval = setInterval(refreshEvents, 5000);

  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/observability') {
      render(container, state);
    }
  });
}

export function onDeactivate() {
  
  if (unsubscribe) unsubscribe();
  if (pollInterval) clearInterval(pollInterval);
}

async function refreshEvents() {
  if (store.observability.endpointUnavailable) {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    return;
  }

  try {
    const res = await api.getEvents();
    if (res.success) {
      actions.setObservabilityEvents(res.data || []);
    } else if (res.error?.code === 'API_ERROR_404') {
      actions.setObservabilityUnavailable(true);
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  } catch (err) {
    console.error('Telemetry refresh failed:', err);
  }
}
