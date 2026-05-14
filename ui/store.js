/**
 * ProofPost V1.1 — Reactive Store
 * ui/store.js
 * 
 * Single source of truth using Proxy-based reactivity.
 * Enforcement: All mutations must go through the 'actions' object.
 */

/** @typedef {import('./store.js').State} State */

const STORAGE_KEYS = {
  THEME: 'pp_theme',
  ONBOARDING: 'pp_onboarding',
  SIDEBAR: 'pp_sidebar',
  DRAFT_PREFIX: 'pp_draft_'
};

/**
 * Initial State Schema
 * docs/v1.1/UI_STATE_SCHEMA.md
 */
const initialState = {
  app: {
    initialized: false,
    loading: false,
    route: 'dashboard',
    setupComplete: false,
    apiOnline: false,
    version: 'v1.1',
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
    lastHealthCheck: null
  },
  ui: {
    activeModal: null,
    sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.SIDEBAR) === 'true',
    toastQueue: [],
    focusedFactId: null,
    keyboardMode: false,
    globalError: null
  },
  workspace: {
    selectedFactId: null,
    selectedPlatform: 'bluesky',
    facts: [],
    loading: false,
    error: null,
    draftContent: '',
    originalContent: '',
    hasUnsavedChanges: false,
    verificationExpanded: true,
    dispatching: false,
    dispatchResult: null
  },
  observability: {
    events: [],
    polling: false,
    lastEventId: null,
    connectionStatus: 'online'
  },
  settings: {
    loaded: false,
    ai: {
      provider: '',
      model: ''
    },
    ingestion: {
      hmacConfigured: false
    },
    ui: {
      onboardingComplete: localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true'
    }
  },
  platforms: {
    items: [],
    loading: false,
    error: null
  },
  history: {
    items: [],
    loading: false,
    error: null,
    filters: {
      platform: 'all',
      status: 'all'
    }
  }
};

// Internal flag to allow mutations only via actions
let isActionRunning = false;
const listeners = new Set();

/**
 * Proxy Handler
 * Intercepts all set operations to ensure they happen within actions
 * and notifies subscribers of changes.
 */
const handler = {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (value !== null && typeof value === 'object') {
      return new Proxy(value, handler);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    if (!isActionRunning) {
      console.warn(`Illegal mutation attempt on property "${prop}". Use actions to modify state.`);
      return true; // Silently fail or throw in strict mode
    }
    const result = Reflect.set(target, prop, value, receiver);
    notify();
    return result;
  }
};

/**
 * Global Store instance (proxied)
 */
export const store = new Proxy(initialState, handler);

/**
 * Subscribe to store changes
 * @param {Function} callback 
 * @returns {Function} Unsubscribe function
 */
export const subscribe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/**
 * Notify all listeners of a state change
 */
function notify() {
  listeners.forEach(callback => callback(store));
}

/**
 * Actions Object
 * The ONLY place where state mutations are allowed.
 */
export const actions = {
  /**
   * Wrapper to enable mutations
   * @param {Function} fn 
   */
  _mutate(fn) {
    isActionRunning = true;
    try {
      fn();
    } finally {
      isActionRunning = false;
    }
  },

  // --- APP ACTIONS ---

  setInitialized(val) {
    this._mutate(() => { store.app.initialized = val; });
  },

  setLoading(val) {
    this._mutate(() => { store.app.loading = val; });
  },

  setRoute(route) {
    this._mutate(() => { store.app.route = route; });
  },

  setTheme(theme) {
    this._mutate(() => {
      store.app.theme = theme;
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    });
  },

  updateHealth(status) {
    this._mutate(() => {
      store.app.apiOnline = status.online;
      store.app.lastHealthCheck = Date.now();
    });
  },

  // --- UI ACTIONS ---

  setSidebarCollapsed(val) {
    this._mutate(() => {
      store.ui.sidebarCollapsed = val;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR, val);
    });
  },

  addToast(toast) {
    this._mutate(() => {
      store.ui.toastQueue.push({ ...toast, id: Date.now() });
      if (store.ui.toastQueue.length > 3) store.ui.toastQueue.shift();
    });
  },

  // --- WORKSPACE ACTIONS ---

  setPendingFacts(facts) {
    this._mutate(() => {
      store.workspace.facts = facts;
    });
  },

  selectFact(id) {
    this._mutate(() => {
      store.workspace.selectedFactId = id;
      const fact = store.workspace.facts.find(f => f.id === id);
      if (fact) {
        store.workspace.originalContent = fact.summary;
        // Rehydration logic
        const draft = localStorage.getItem(STORAGE_KEYS.DRAFT_PREFIX + id);
        store.workspace.draftContent = draft || fact.summary;
        store.workspace.hasUnsavedChanges = !!draft && draft !== fact.summary;
      } else {
        store.workspace.originalContent = '';
        store.workspace.draftContent = '';
        store.workspace.hasUnsavedChanges = false;
      }
    });
  },

  updateDraft(content) {
    this._mutate(() => {
      store.workspace.draftContent = content;
      store.workspace.hasUnsavedChanges = content !== store.workspace.originalContent;
      
      if (store.workspace.selectedFactId) {
        if (store.workspace.hasUnsavedChanges) {
          localStorage.setItem(STORAGE_KEYS.DRAFT_PREFIX + store.workspace.selectedFactId, content);
        } else {
          localStorage.removeItem(STORAGE_KEYS.DRAFT_PREFIX + store.workspace.selectedFactId);
        }
      }
    });
  },

  clearDraft(id) {
    this._mutate(() => {
      localStorage.removeItem(STORAGE_KEYS.DRAFT_PREFIX + id);
      if (store.workspace.selectedFactId === id) {
        store.workspace.draftContent = store.workspace.originalContent;
        store.workspace.hasUnsavedChanges = false;
      }
    });
  },

  // --- SETTINGS ACTIONS ---

  updateSettings(data) {
    this._mutate(() => {
      if (data.ai) store.settings.ai = { ...store.settings.ai, ...data.ai };
      if (data.ingestion) store.settings.ingestion = { ...store.settings.ingestion, ...data.ingestion };
      if (data.ui) {
        store.settings.ui = { ...store.settings.ui, ...data.ui };
        if (data.ui.onboardingComplete !== undefined) {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING, data.ui.onboardingComplete);
        }
      }
      store.settings.loaded = true;
    });
  },

  // --- OBSERVABILITY ACTIONS ---

  appendEvent(event) {
    this._mutate(() => {
      store.observability.events.push(event);
      store.observability.lastEventId = event.id;
    });
  },

  // --- HISTORY ACTIONS ---

  setHistoryItems(items) {
    this._mutate(() => {
      store.history.items = items;
    });
  }
};
