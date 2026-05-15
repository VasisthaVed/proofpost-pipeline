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
    setupComplete: localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true',
    apiOnline: false,
    version: 'v1.1',
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
    lastHealthCheck: null
  },
  ui: {
    activeModal: null, // { title, body, confirmLabel, onConfirm }
    sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.SIDEBAR) === 'true',
    setupStep: parseInt(localStorage.getItem(STORAGE_KEYS.SETUP_STEP) || '1'),
    toastQueue: [],
    focusedFactId: null,
    keyboardMode: false,
    globalError: null,
    setupStep: 1,
    activeSettingsTab: 'ai'
  },
  workspace: {
    selectedFactId: null,
    selectedPlatform: 'bluesky',
    facts: [],
    loading: false,
    error: null,
    draftContent: {
      bluesky: '',
      linkedin: ''
    },
    originalContent: '',
    verificationExpanded: true,
    dispatching: false,
    dispatchResult: null,
    previewMode: false
  },
  observability: {
    events: [],
    polling: false,
    lastEventId: null,
    connectionStatus: 'online',
    endpointUnavailable: false
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

  setSetupComplete(val) {
    this._mutate(() => { 
      store.app.setupComplete = val;
      localStorage.setItem(STORAGE_KEYS.ONBOARDING, val);
      if (val) localStorage.removeItem(STORAGE_KEYS.SETUP_STEP);
    });
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
      const newToast = { 
        ...toast, 
        id: Date.now(),
        persist: toast.type === 'error' // Errors persist by default
      };
      store.ui.toastQueue.push(newToast);
      if (store.ui.toastQueue.length > 3) store.ui.toastQueue.shift();
    });
  },

  setSetupStep(step) {
    this._mutate(() => { 
      store.ui.setupStep = step;
      localStorage.setItem(STORAGE_KEYS.SETUP_STEP, step);
    });
  },

  setSettingsTab(tab) {
    this._mutate(() => { store.ui.activeSettingsTab = tab; });
  },

  setModal(modal) {
    this._mutate(() => { store.ui.activeModal = modal; });
  },

  closeModal() {
    this._mutate(() => { store.ui.activeModal = null; });
  },

  // --- WORKSPACE ACTIONS ---

  selectPlatform(platform) {
    this._mutate(() => { store.workspace.selectedPlatform = platform; });
  },

  setPreviewMode(val) {
    this._mutate(() => { store.workspace.previewMode = val; });
  },

  setDispatching(val) {
    this._mutate(() => { store.workspace.dispatching = val; });
  },

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
        // Rehydration logic per platform
        const platforms = ['bluesky', 'linkedin'];
        platforms.forEach(platform => {
          const draftKey = `${STORAGE_KEYS.DRAFT_PREFIX}${id}_${platform}`;
          const draft = localStorage.getItem(draftKey);
          store.workspace.draftContent[platform] = draft || fact.summary;
        });
      } else {
        store.workspace.originalContent = '';
        store.workspace.draftContent = { bluesky: '', linkedin: '' };
      }
    });
  },

  updateDraft(content) {
    this._mutate(() => {
      const platform = store.workspace.selectedPlatform;
      store.workspace.draftContent[platform] = content;
      
      if (store.workspace.selectedFactId) {
        const draftKey = `${STORAGE_KEYS.DRAFT_PREFIX}${store.workspace.selectedFactId}_${platform}`;
        if (content !== store.workspace.originalContent) {
          localStorage.setItem(draftKey, content);
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    });
  },

  clearDraft(id) {
    this._mutate(() => {
      const platforms = ['bluesky', 'linkedin'];
      platforms.forEach(platform => {
        localStorage.removeItem(`${STORAGE_KEYS.DRAFT_PREFIX}${id}_${platform}`);
      });
      
      if (store.workspace.selectedFactId === id) {
        store.workspace.draftContent = {
          bluesky: store.workspace.originalContent,
          linkedin: store.workspace.originalContent
        };
      }
    });
  },

  resetDraft() {
    this._mutate(() => {
      const id = store.workspace.selectedFactId;
      if (!id) return;
      
      const platform = store.workspace.selectedPlatform;
      localStorage.removeItem(`${STORAGE_KEYS.DRAFT_PREFIX}${id}_${platform}`);
      store.workspace.draftContent[platform] = store.workspace.originalContent;
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

  setObservabilityEvents(events) {
    this._mutate(() => { store.observability.events = events; });
  },

  setObservabilityUnavailable(val) {
    this._mutate(() => { store.observability.endpointUnavailable = val; });
  },

  clearObservabilityEvents() {
    this._mutate(() => { store.observability.events = []; });
  },

  setPlatforms(items) {
    this._mutate(() => {
      store.platforms.items = items;
    });
  },

  // --- HISTORY ACTIONS ---

  setHistoryItems(items) {
    this._mutate(() => {
      store.history.items = items;
    });
  },

  setHistoryFilters(filters) {
    this._mutate(() => {
      store.history.filters = { ...store.history.filters, ...filters };
    });
  }
};
