/**
 * ProofPost V1.1 — Router
 * ui/router.js
 * 
 * Vanilla History API router with view lifecycle management and onboarding guards.
 */

import { store, actions } from './store.js';
import { updateTitle } from './utils.js';

export const ROUTES = {
  DASHBOARD: '/dashboard',
  SETUP: '/setup',
  WORKSPACE: '/workspace',
  OBSERVABILITY: '/observability',
  HISTORY: '/history',
  PLATFORMS: '/platforms',
  SETTINGS: '/settings',
  DOCS: '/docs'
};

const routeMap = {
  [ROUTES.DASHBOARD]: 'dashboard',
  [ROUTES.SETUP]: 'setup',
  [ROUTES.WORKSPACE]: 'workspace',
  [ROUTES.OBSERVABILITY]: 'observability',
  [ROUTES.HISTORY]: 'history',
  [ROUTES.PLATFORMS]: 'platforms',
  [ROUTES.SETTINGS]: 'settings',
  [ROUTES.DOCS]: 'docs'
};

let currentViewModule = null;

/**
 * Navigate to a new path
 * @param {string} path 
 */
export async function navigate(path) {
  // 1. Root redirect
  if (path === '/' || path === '') {
    return navigate(ROUTES.DASHBOARD);
  }

  // 1.1 Unsaved Draft Check
  if (isDraftDirty()) {
    actions.setModal({
      title: 'Unsaved Changes',
      body: 'You have unsaved edits in your workspace. Navigating away will discard these changes. Proceed anyway?',
      confirmLabel: 'Discard & Proceed',
      onConfirm: () => {
        // Clear dirty state is implicit because we won't be on the workspace anymore
        // or the specific fact will be different.
        // For now, we just proceed with navigation.
        actions.closeModal();
        performNavigation(path);
      }
    });
    return;
  }

  performNavigation(path);
}

/**
 * Internal navigation execution
 * @param {string} path 
 */
async function performNavigation(path) {
  // 2. Run Route Guards
  const guardedPath = runGuards(path);
  if (guardedPath !== path) {
    return navigate(guardedPath);
  }

  // 3. Lifecycle: onDeactivate current view
  if (currentViewModule?.onDeactivate) {
    currentViewModule.onDeactivate();
  }

  // 4. Update History
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }

  // 5. Update State
  const viewName = routeMap[path] || 'dashboard';
  actions.setRoute(path);

  // 6. Update Browser UI
  window.scrollTo(0, 0);
  updateTitle(viewName);

  // 7. Load and Initialize View
  try {
    currentViewModule = await import(`./views/${viewName}.js`);
    
    const container = document.getElementById('view-container');
    if (container) {
      // Trigger View Transition Animation
      container.classList.remove('view-fade-in');
      void container.offsetWidth; // Force reflow
      container.classList.add('view-fade-in');
      
      // Clear container before render
      container.innerHTML = '';
      
      // Render
      currentViewModule.render(container, store);
      
      // 8. Focus Management: Focus primary heading
      const h1 = container.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus();
      }
      
      // Lifecycle: onActivate new view
      if (currentViewModule.onActivate) {
        currentViewModule.onActivate();
      }
    }
  } catch (err) {
    console.error(`Failed to load view: ${viewName}`, err);
    // Fallback to dashboard or error view
    if (path !== ROUTES.DASHBOARD) navigate(ROUTES.DASHBOARD);
  }
}

/**
 * Run route guards (Onboarding guard)
 * @param {string} path 
 * @returns {string} The allowed path
 */
function runGuards(path) {
  const isPublic = [ROUTES.SETUP, ROUTES.DOCS, ROUTES.SETTINGS].includes(path);
  
  if (!store.app.setupComplete && !isPublic) {
    console.warn('Onboarding incomplete. Redirecting to /setup.');
    return ROUTES.SETUP;
  }
  
  return path;
}

/**
 * Check if the current workspace draft is dirty
 */
function isDraftDirty() {
  if (store.app.route !== ROUTES.WORKSPACE) return false;
  
  const platform = store.workspace.selectedPlatform;
  const current = store.workspace.draftContent[platform];
  const original = store.workspace.originalContent;
  
  return current !== original;
}

/**
 * Browser-level navigation protection
 */
window.onbeforeunload = (e) => {
  if (isDraftDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
};

/**
 * Handle browser back/forward buttons
 */
window.addEventListener('popstate', () => {
  navigate(window.location.pathname);
});

/**
 * Initial boot navigation
 */
export function initRouter() {
  navigate(window.location.pathname);
}
