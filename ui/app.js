/**
 * ProofPost V1.1 — Main Application Entry
 * ui/app.js
 */

import { store, actions, subscribe } from './store.js';
import { initRouter, navigate } from './router.js';
import { escapeHtml } from './utils.js';
import { api } from './api.js';

// Import Custom Elements
import './components/status-dot.js';
import './components/fact-card.js';
import './components/modal.js';
import './components/loading.js';
import './components/empty-state.js';
import './components/platform-card.js';
import { initToastManager } from './components/toast.js';

/**
 * One-shot server sync before first route render (operator truth on cold load).
 */
async function hydrateFromServer() {
  const [h, s, pl, hist, facts, aiStat, ngrokStat] = await Promise.all([
    api.getHealth(),
    api.getSettings(),
    api.getPlatforms(),
    api.getHistory(),
    api.getPendingFacts(),
    api.getAiStatus(),
    api.getNgrokStatus()
  ]);
  if (h.success) actions.updateHealth(h.data);
  else actions.updateHealth({ online: false });
  if (s.success) actions.updateSettings(s.data);
  if (pl.success) actions.setPlatforms(pl.data.platforms || []);
  if (hist.success) actions.setHistoryItems(hist.data.items || []);
  if (facts.success) actions.setPendingFacts(facts.data.items || []);
  if (aiStat.success) actions.updateAiStatus(aiStat.data);
  if (ngrokStat.success) actions.updateNgrokStatus(ngrokStat.data);
}

/**
 * Boot the application
 */
async function boot() {
  // 0. Persistent Sidebar Flash Protection
  if (localStorage.getItem('pp_sidebar') === 'true') {
    document.getElementById('app-shell')?.classList.add('app-shell--collapsed');
  }

  // 1. Initialize Event Delegation for Navigation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route]');
    if (link) {
      e.preventDefault();
      navigate(link.getAttribute('data-route'));
    }
  });

  // 2. Global Event Listeners
  window.addEventListener('navigate', (e) => navigate(e.detail));
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const newTheme = store.app.theme === 'dark' ? 'light' : 'dark';
      actions.setTheme(newTheme);
    });
  }

  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      actions.toggleSidebar();
    });
  }

  // 3. Subscribe to state changes for global UI updates
  subscribe((state) => updateGlobalUI(state));

  try {
    await hydrateFromServer();
  } finally {
    actions.setServerHydrated(true);
  }

  // 4. Initialize Router & Toast (first paint after store matches server)
  await initRouter();
  initToastManager();

  actions.setInitialized(true);

  // 5. Global Health, AI, & Ngrok Polling (fixes BUG-B11)
  setInterval(async () => {
    const [h, aiStat, ngrokStat] = await Promise.all([api.getHealth(), api.getAiStatus(), api.getNgrokStatus()]);
    if (h.success) actions.updateHealth(h.data);
    else actions.updateHealth({ online: false });
    if (aiStat.success) actions.updateAiStatus(aiStat.data);
    if (ngrokStat.success) actions.updateNgrokStatus(ngrokStat.data);
  }, 5000);
}

/**
 * Update global shell elements
 */
function updateGlobalUI(state) {
  document.documentElement.setAttribute('data-theme', state.app.theme);
  document.documentElement.toggleAttribute('data-server-hydrated', Boolean(state.app.server_hydrated));
  
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.classList.toggle('app-shell--collapsed', state.ui.sidebarCollapsed);
  }

  const dot = document.getElementById('global-status-dot');
  const text = document.getElementById('global-status-text');
  const aiText = document.getElementById('global-ai-status-text');
  const ngrokText = document.getElementById('global-ngrok-status-text');
  
  if (dot) dot.setAttribute('status', state.app.api_online ? 'online' : 'offline');
  if (text) text.textContent = state.app.api_online ? 'OPERATIONAL' : 'DISCONNECTED';
  if (aiText) {
    const p = state.app.ai_status?.working_provider?.toUpperCase() || 'MOCK';
    const m = state.app.ai_status?.working_model || '';
    aiText.textContent = `AI: ${p} ${m ? `(${m})` : ''}`;
  }
  if (ngrokText) {
    const connected = state.app.ngrok_status?.connected;
    const pubUrl = state.app.ngrok_status?.public_url || '';
    if (connected && pubUrl) {
      const cleanUrl = pubUrl.replace('https://', '');
      ngrokText.textContent = cleanUrl.length > 20 ? cleanUrl.substring(0, 18) + '...' : cleanUrl;
      ngrokText.className = 'text-xs font-semibold mono text-brand uppercase';
      ngrokText.title = `Active ngrok tunnel: ${pubUrl}`;
    } else {
      ngrokText.textContent = 'NGROK: DISCONNECTED';
      ngrokText.className = 'text-xs font-semibold mono text-secondary uppercase';
      ngrokText.title = 'ngrok tunnel not running on port 4040';
    }
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    const route = item.getAttribute('data-route');
    item.classList.toggle('nav-item--active', state.app.route === route);
  });

  // Global Modal
  let modal = document.getElementById('global-modal');
  if (!modal) {
    modal = document.createElement('pp-modal');
    modal.id = 'global-modal';
    document.body.appendChild(modal);
    modal.addEventListener('pp-close', () => actions.closeModal());
  }

  if (state.ui.activeModal) {
    modal.modalTitle = state.ui.activeModal.title;
    modal.bodyText = state.ui.activeModal.body;
    modal.bodyIsPre = Boolean(state.ui.activeModal.bodyIsPre);
    modal.confirmLabel = state.ui.activeModal.confirmLabel || (state.ui.activeModal.hideCancel ? 'Close' : 'Confirm');
    modal.hideCancel = Boolean(state.ui.activeModal.hideCancel);
    modal.open = true;

    if (modal._confirmHandler) modal.removeEventListener('pp-confirm', modal._confirmHandler);
    modal._confirmHandler = () => {
      if (state.ui.activeModal?.onConfirm) state.ui.activeModal.onConfirm();
      actions.closeModal();
    };
    modal.addEventListener('pp-confirm', modal._confirmHandler);
  } else {
    modal.open = false;
  }
}

// Start
boot();
