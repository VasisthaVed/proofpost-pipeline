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
  DOCS: '/docs',
  AI: '/ai'
};

const routeMap = {
  [ROUTES.DASHBOARD]: 'dashboard',
  [ROUTES.SETUP]: 'setup',
  [ROUTES.WORKSPACE]: 'workspace',
  [ROUTES.OBSERVABILITY]: 'observability',
  [ROUTES.HISTORY]: 'history',
  [ROUTES.PLATFORMS]: 'platforms',
  [ROUTES.SETTINGS]: 'settings',
  [ROUTES.DOCS]: 'docs',
  [ROUTES.AI]: 'ai'
};

let currentViewModule = null;
/** Navigation target when resolving draft modal or string/object detail. */
let pendingNav = { path: ROUTES.DASHBOARD, settingsTab: undefined };

function normalizeNavDetail(detail) {
  if (typeof detail === 'string') {
    return { path: detail, settingsTab: undefined };
  }
  if (detail && typeof detail === 'object') {
    const path = detail.path || ROUTES.DASHBOARD;
    const settingsTab = detail.settingsTab || undefined;
    return { path, settingsTab };
  }
  return { path: ROUTES.DASHBOARD, settingsTab: undefined };
}

/**
 * Navigate to a new path (string) or { path, settingsTab? } for Settings deep-link.
 * @param {string|{ path: string, settingsTab?: string }} detail
 */
export async function navigate(detail) {
  pendingNav = normalizeNavDetail(detail);
  let path = pendingNav.path;

  if (path === '/' || path === '') {
    path = ROUTES.DASHBOARD;
    pendingNav = { ...pendingNav, path };
  }

  if (isDraftDirty()) {
    actions.setModal({
      title: 'Unsaved Changes',
      body: 'You have unsaved edits in your workspace. Navigating away will discard these changes. Proceed anyway?',
      confirmLabel: 'Discard & Proceed',
      onConfirm: () => {
        actions.closeModal();
        performNavigation(pendingNav.path, { settingsTab: pendingNav.settingsTab });
      }
    });
    return;
  }

  await performNavigation(pendingNav.path, { settingsTab: pendingNav.settingsTab });
}

/**
 * Internal navigation execution
 * @param {string} path
 * @param {{ settingsTab?: string }} [navOptions]
 */
async function performNavigation(path, navOptions = {}) {
  const guardedPath = runGuards(path);
  if (guardedPath !== path) {
    await navigate(guardedPath);
    return;
  }

  const oldPath = store.app.route;
  actions.setScrollPosition(oldPath, window.scrollY);

  if (currentViewModule?.onDeactivate) {
    currentViewModule.onDeactivate();
  }

  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }

  const viewName = routeMap[path] || 'dashboard';
  actions.setRoute(path);

  if (navOptions.settingsTab) {
    actions.setSettingsTab(navOptions.settingsTab);
  }

  updateTitle(viewName);

  try {
    currentViewModule = await import(`./views/${viewName}.js`);

    const container = document.getElementById('view-container');
    if (container) {
      container.classList.remove('view-fade-in');
      void container.offsetWidth;
      container.classList.add('view-fade-in');

      container.innerHTML = '';

      currentViewModule.render(container, store);

      const h1 = container.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus();
      }

      if (currentViewModule.onActivate) {
        await currentViewModule.onActivate();
      }

      const cachedScroll = store.ui.scrollCache[path];
      if (cachedScroll !== undefined) {
        window.scrollTo(0, cachedScroll);
      } else {
        window.scrollTo(0, 0);
      }
    }
  } catch (err) {
    console.error(`Failed to load view: ${viewName}`, err);
    if (path !== ROUTES.DASHBOARD) await navigate(ROUTES.DASHBOARD);
  }
}

function runGuards(path) {
  const isPublic = [ROUTES.SETUP, ROUTES.DOCS, ROUTES.SETTINGS, ROUTES.AI].includes(path);

  if (!store.app.setup_complete && !isPublic) {
    console.warn('Onboarding incomplete. Redirecting to /setup.');
    return ROUTES.SETUP;
  }

  return path;
}

function isDraftDirty() {
  if (store.app.route !== ROUTES.WORKSPACE) return false;

  const original = store.workspace.originalContent;
  const drafts = store.workspace.draftContent;

  // Check if any platform has a draft that differs from the original fact summary
  // and is not just an empty string (unless the original was also empty)
  return Object.values(drafts).some(draft => draft && draft !== original);
}

window.onbeforeunload = (e) => {
  if (isDraftDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
};

window.addEventListener('popstate', () => {
  navigate(window.location.pathname);
});

/**
 * Initial boot navigation (await after server hydration).
 */
export async function initRouter() {
  await navigate(window.location.pathname);
}
