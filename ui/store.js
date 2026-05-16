/**
 * ProofPost V1.1 — Reactive Store
 * ui/store.js
 * 
 * Single source of truth using Proxy-based reactivity.
 * Enforcement: All mutations must go through the 'actions' object.
 */

/** @typedef {import('./store.js').State} State */
import { api } from './api.js';

const STORAGE_KEYS = {
  THEME: 'pp_theme',
  ONBOARDING: 'pp_onboarding',
  SIDEBAR: 'pp_sidebar',
  SETUP_STEP: 'pp_setup_step',
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
    route: '/dashboard',
    setup_complete: localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true',
    api_online: false,
    version: 'v1.1.1',
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
    last_health_check: null,
    server_hydrated: false,
    ai_status: { working_provider: 'None', working_model: 'None', working_id: 'None', total_enabled: 0, failover_chain: [] }
  },
  ui: {
    activeModal: null, // { title, body, confirmLabel, onConfirm }
    sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.SIDEBAR) === 'true',
    setupStep: (() => {
      const raw = parseInt(localStorage.getItem(STORAGE_KEYS.SETUP_STEP) || '1', 10);
      const n = Number.isFinite(raw) ? raw : 1;
      return Math.min(5, Math.max(1, n));
    })(),
    toastQueue: [],
    focusedFactId: null,
    keyboardMode: false,
    globalError: null,
    activeSettingsTab: 'ai',
    scrollCache: {}
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
    aiPreview: {
      bluesky: '',
      linkedin: ''
    },
    verificationExpanded: true,
    dispatching: false,
    dispatchResult: null,
    previewMode: false,
    previewCache: {} // key: factId_platform, value: { text, source, timestamp }
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
      model: '',
      providers: [],
      availableModels: {
        gemini: ['gemini-2.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        groq: ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        mock: ['mock', 'mock-reasoning', 'mock-fast']
      }
    },
    ingestion: {
      hmac_configured: false
    },
    platforms: {
      bluesky: { enabled: false, handle: '', app_password: '' },
      linkedin: { enabled: false, access_token: '' }
    },
    dry_run: false,
    dev_mode: false,
    ui: {
      onboarding_complete: localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true'
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
      status: 'all',
      platform: 'all'
    }
  }
};

/**
 * Recursive Proxy handler to intercept all state mutations.
 * Enforces that mutations can only occur within an active action context.
 * 
 * @param {object} target 
 * @param {string} prefix 
 * @returns {Proxy}
 */
function createReactiveProxy(target, prefix = '') {
  return new Proxy(target, {
    get(obj, prop) {
      const val = obj[prop];
      if (val && typeof val === 'object' && !Object.isFrozen(val)) {
        return createReactiveProxy(val, `${prefix}${prop}.`);
      }
      return val;
    },
    set(obj, prop, value) {
      if (!actions._isMutating) {
        console.error(`Illegal state mutation: Cannot set '${prefix}${String(prop)}' outside of actions.`);
        throw new Error(`Illegal state mutation: Cannot set '${prefix}${String(prop)}' outside of actions.`);
      }
      const oldVal = obj[prop];
      obj[prop] = value;
      if (oldVal !== value) {
        notifySubscribers();
      }
      return true;
    },
    deleteProperty(obj, prop) {
      if (!actions._isMutating) {
        console.error(`Illegal state mutation: Cannot delete '${prefix}${String(prop)}' outside of actions.`);
        throw new Error(`Illegal state mutation: Cannot delete '${prefix}${String(prop)}' outside of actions.`);
      }
      delete obj[prop];
      notifySubscribers();
      return true;
    }
  });
}

/** @type {State} */
export const store = createReactiveProxy(initialState);

const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach(fn => fn(store));
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// ==========================================
// ACTIONS
// ==========================================

export const actions = {
  _isMutating: false,

  _mutate(fn) {
    this._isMutating = true;
    try {
      fn();
    } finally {
      this._isMutating = false;
    }
  },

  // --- APP ACTIONS ---

  setInitialized(val) {
    this._mutate(() => { store.app.initialized = val; });
  },

  setServerHydrated(val) {
    this._mutate(() => { store.app.server_hydrated = val; });
  },

  setLoading(val) {
    this._mutate(() => { store.app.loading = val; });
  },

  updateAiStatus(status) {
    this._mutate(() => { store.app.ai_status = status; });
  },

  setRoute(route) {
    this._mutate(() => { store.app.route = route; });
  },

  setSetupComplete(val) {
    this._mutate(() => { 
      store.app.setup_complete = val;
      store.settings.ui.onboarding_complete = val;
      localStorage.setItem(STORAGE_KEYS.ONBOARDING, String(val));
      if (val) {
        localStorage.removeItem(STORAGE_KEYS.SETUP_STEP);
      } else {
        localStorage.setItem(STORAGE_KEYS.SETUP_STEP, '1');
        store.ui.setupStep = 1;
      }
    });
    api.saveSettings({ ui: { onboarding_complete: val } }).catch(err => {
      console.error('Failed to persist onboarding_complete to backend:', err);
    });
  },

  setTheme(theme) {
    this._mutate(() => {
      store.app.theme = theme;
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    });
  },

  /**
   * @param {object} status — `/health` body (`status`, `db`, …) or `{ online: boolean }`
   */
  updateHealth(status) {
    this._mutate(() => {
      const online =
        typeof status?.online === 'boolean'
          ? status.online
          : status?.status === 'ok' && Boolean(status?.db);
      store.app.api_online = online;
      store.app.last_health_check = Date.now();
    });
  },

  // --- UI ACTIONS ---

  setSidebarCollapsed(val) {
    this._mutate(() => {
      store.ui.sidebarCollapsed = val;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR, val);
    });
  },

  toggleSidebar() {
    this.setSidebarCollapsed(!store.ui.sidebarCollapsed);
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
      const n = Number.isFinite(Number(step)) ? Number(step) : 1;
      const clamped = Math.min(5, Math.max(1, n));
      store.ui.setupStep = clamped;
      localStorage.setItem(STORAGE_KEYS.SETUP_STEP, String(clamped));
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

  setScrollPosition(route, pos) {
    this._mutate(() => { store.ui.scrollCache[route] = pos; });
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
        const platforms = store.platforms.items.length > 0 ? store.platforms.items.map(p => p.id) : ['bluesky', 'linkedin'];
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
      const platforms = store.platforms.items.length > 0 ? store.platforms.items.map(p => p.id) : ['bluesky', 'linkedin'];
      platforms.forEach(platform => {
        localStorage.removeItem(`${STORAGE_KEYS.DRAFT_PREFIX}${id}_${platform}`);
      });
      
      if (store.workspace.selectedFactId === id) {
        store.workspace.draftContent = {};
        platforms.forEach(platform => {
          store.workspace.draftContent[platform] = store.workspace.originalContent;
        });
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

  setPreviewCache(key, value) {
    this._mutate(() => {
      store.workspace.previewCache[key] = value;
    });
  },

  cleanupPreviewCache() {
    this._mutate(() => {
      const now = Date.now();
      const cache = store.workspace.previewCache;
      const PREVIEW_CACHE_MAX_SIZE = 50;
      const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;

      // Remove expired entries
      Object.keys(cache).forEach(key => {
        if (now - cache[key].timestamp > PREVIEW_CACHE_TTL_MS) {
          delete cache[key];
        }
      });

      // If still over limit, remove oldest entries
      const keys = Object.keys(cache);
      if (keys.length > PREVIEW_CACHE_MAX_SIZE) {
        keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        const toRemove = keys.length - PREVIEW_CACHE_MAX_SIZE;
        for (let i = 0; i < toRemove; i++) {
          delete cache[keys[i]];
        }
      }
    });
  },

  // --- SETTINGS ACTIONS ---

  updateSettings(data) {
    this._mutate(() => {
      if (data.ai) {
        store.settings.ai = { ...store.settings.ai, ...data.ai };
      }
      if (data.ingestion) {
        store.settings.ingestion = { ...store.settings.ingestion, ...data.ingestion };
      }
      if (data.platforms) {
        const p = data.platforms;
        store.settings.platforms = {
          bluesky: { ...store.settings.platforms.bluesky, ...(p.bluesky || {}) },
          linkedin: { ...store.settings.platforms.linkedin, ...(p.linkedin || {}) }
        };
      }
      if (data.dry_run !== undefined) store.settings.dry_run = data.dry_run;
      if (data.dev_mode !== undefined) store.settings.dev_mode = data.dev_mode;
      if (data.ui) {
        store.settings.ui = { ...store.settings.ui, ...data.ui };
        if (data.ui.onboarding_complete !== undefined) {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING, String(data.ui.onboarding_complete));
          store.app.setup_complete = Boolean(data.ui.onboarding_complete);
        }
      }
      store.settings.loaded = true;
    });
  },

  setAiProviders(providers) {
    this._mutate(() => {
      store.settings.ai.providers = providers;
    });
  },

  updateAiProvider(id, updates) {
    this._mutate(() => {
      const idx = store.settings.ai.providers.findIndex(p => p.id === id);
      if (idx !== -1) {
        store.settings.ai.providers[idx] = { ...store.settings.ai.providers[idx], ...updates };
      }
    });
  },

  reorderAiProviders(providerIds) {
    this._mutate(() => {
      const currentMap = new Map(store.settings.ai.providers.map(p => [p.id, p]));
      const reordered = [];
      providerIds.forEach((id, index) => {
        if (currentMap.has(id)) {
          const p = currentMap.get(id);
          p.priority = index + 1;
          reordered.push(p);
          currentMap.delete(id);
        }
      });
      currentMap.forEach(p => {
        p.priority = reordered.length + 1;
        reordered.push(p);
      });
      store.settings.ai.providers = reordered;
    });
  },

  setAvailableModels(provider, models) {
    this._mutate(() => {
      store.settings.ai.availableModels[provider] = models;
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
