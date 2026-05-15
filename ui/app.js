/**
 * ProofPost V1.1 — Main Application Entry
 * ui/app.js
 */

import { store, actions, subscribe } from './store.js';
import { initRouter, navigate } from './router.js';
import { escapeHtml } from './utils.js';

// Import Custom Elements
import './components/status-dot.js';
import './components/fact-card.js';
import './components/modal.js';
import './components/loading.js';
import './components/empty-state.js';
import './components/platform-card.js';
import { initToastManager } from './components/toast.js';

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

  // 4. Initialize Router & Toast
  initRouter();
  initToastManager();

  actions.setInitialized(true);
}

/**
 * Update global shell elements
 */
function updateGlobalUI(state) {
  document.documentElement.setAttribute('data-theme', state.app.theme);
  
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.classList.toggle('app-shell--collapsed', state.ui.sidebarCollapsed);
  }

  const dot = document.getElementById('global-status-dot');
  const text = document.getElementById('global-status-text');
  
  if (dot) dot.setAttribute('status', state.app.apiOnline ? 'online' : 'offline');
  if (text) text.textContent = state.app.apiOnline ? 'OPERATIONAL' : 'DISCONNECTED';

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
    modal.setAttribute('title', state.ui.activeModal.title);
    modal.open = true;
    
    // Inject body and actions (since pp-modal uses innerHTML, we do it safely)
    const body = modal.querySelector('.modal-body');
    const footer = modal.querySelector('.modal-footer');
    
    if (body && footer) {
      body.innerHTML = `<p class="text-secondary">${escapeHtml(state.ui.activeModal.body)}</p>`;
      footer.innerHTML = `
        <button class="btn btn--ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn--primary" id="modal-confirm">${state.ui.activeModal.confirmLabel || 'Confirm'}</button>
      `;
      
      footer.querySelector('#modal-cancel').onclick = () => actions.closeModal();
      footer.querySelector('#modal-confirm').onclick = () => {
        state.ui.activeModal.onConfirm();
        actions.closeModal();
      };
    }
  } else {
    modal.open = false;
  }
}

// Start
boot();
