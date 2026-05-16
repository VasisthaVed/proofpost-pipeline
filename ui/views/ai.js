/**
 * ProofPost V1.1.1 — AI Orchestration View
 * ui/views/ai.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let viewError = null;
let aiSigLast = '';
let aiDelegatesAbort = null;
let activeModalData = null;
let testingId = null;
let refreshingModels = false;

function aiRenderSignature(state) {
  if (state.app.route !== '/ai') return null;
  return JSON.stringify({
    providers: state.settings.ai.providers,
    availableModels: state.settings.ai.availableModels,
    loading: state.app.loading,
    err: viewError,
    modal: activeModalData,
    testing: testingId,
    refreshing: refreshingModels
  });
}

export function render(container, state) {
  const { ai } = state.settings;
  const providers = ai.providers || [];
  const availableModels = ai.availableModels || {};

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>AI Provider Orchestration</h1>
          <p class="text-secondary">Manage multi-provider failover chains, deterministic priority execution, and hybrid model discovery.</p>
        </div>
        <div class="view-header__actions">
          <button class="btn btn--primary" id="btn-add-provider">
            <span class="mr-2">➕</span> Add Provider
          </button>
        </div>
      </div>

      <div class="view-content">
        ${viewError ? `
          <div class="card p-12 text-center flex flex-col items-center gap-6">
            <div class="text-4xl">⚠️</div>
            <div>
              <h2 class="mb-2">AI Registry Sync Failed</h2>
              <p class="text-secondary text-sm">${escapeHtml(viewError)}</p>
            </div>
            <button class="btn btn--primary" id="btn-retry-ai">
              Retry Sync
            </button>
          </div>
        ` : `
          <div class="card mb-8 p-6 bg-raised border border-subtle flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="text-3xl">🛡️</div>
              <div>
                <h3 class="text-sm font-bold mb-1">Deterministic Failover Engine</h3>
                <p class="text-xs text-secondary">Extraction executes sequentially by ascending priority. Secondary providers are invoked automatically if the primary fails or times out.</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold mono px-3 py-1 bg-raised rounded-full border border-subtle">
                ${providers.filter(p => p.enabled).length} ACTIVE PROVIDERS
              </span>
            </div>
          </div>

          <div class="grid grid--1 gap-4 mb-8">
            ${providers.length > 0 ? providers.map((p, idx) => `
              <div class="card p-6 flex items-center justify-between border ${p.enabled ? 'border-subtle' : 'border-dashed opacity-60'}">
                <div class="flex items-center gap-6">
                  <div class="flex flex-col items-center justify-center bg-raised rounded p-2 border border-subtle min-w-[48px]">
                    <span class="text-xs font-bold text-secondary">PRIORITY</span>
                    <span class="text-lg font-extrabold mono">${p.priority}</span>
                  </div>
                  <div>
                    <div class="flex items-center gap-3 mb-1">
                      <span class="text-xl">${p.provider === 'gemini' ? '🌌' : p.provider === 'groq' ? '⚡' : '🤖'}</span>
                      <h3 class="text-base font-bold capitalize">${escapeHtml(p.provider)}</h3>
                      ${idx === 0 ? `<span class="badge badge--primary">Primary</span>` : `<span class="badge badge--ghost">Fallback</span>`}
                      ${!p.enabled ? `<span class="badge badge--danger">Disabled</span>` : ''}
                    </div>
                    <div class="flex items-center gap-4 text-xs text-secondary mono mt-2">
                      <span>Model: <strong class="text-body">${escapeHtml(p.model)}</strong></span>
                      <span>•</span>
                      <span>API Key: <strong class="text-body">${escapeHtml(p.api_key)}</strong></span>
                      <span>•</span>
                      <span>Fallback Target: <strong class="${p.fallback_enabled ? 'text-success' : 'text-warning'}">${p.fallback_enabled ? 'Authorized' : 'Skip'}</strong></span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex flex-col gap-1 mr-2">
                    <button class="btn btn--ghost p-1 text-xs btn-prio-up" data-id="${p.id}" ${idx === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                    <button class="btn btn--ghost p-1 text-xs btn-prio-down" data-id="${p.id}" ${idx === providers.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                  </div>
                  <button class="btn btn--outline btn-edit-p" data-id="${p.id}">Edit</button>
                  <button class="btn btn--outline btn-test-p flex items-center gap-2" data-id="${p.id}" ${testingId === p.id ? 'disabled' : ''}>
                    ${testingId === p.id ? `<div class="spinner spinner--small"></div> Testing...` : `🔌 Test Connection`}
                  </button>
                  <button class="btn btn--ghost p-2 text-danger btn-del-p" data-id="${p.id}" title="Delete Provider">🗑️</button>
                </div>
              </div>
            `).join('') : `
              <div class="card p-12 text-center col-span-full">
                <p class="text-secondary mb-4">No AI providers configured in the failover registry.</p>
                <button class="btn btn--primary" id="btn-add-first-provider">Configure Primary Provider</button>
              </div>
            `}
          </div>
        `}
      </div>

      <!-- Add/Edit Modal Form -->
      ${activeModalData ? `
        <div class="modal-overlay">
          <div class="modal-container card card--raised w-full max-w-2xl" role="dialog" aria-modal="true">
            <header class="modal-header">
              <h3>${activeModalData.mode === 'add' ? 'Add AI Provider' : 'Edit AI Provider'}</h3>
              <button class="btn btn--ghost p-2" id="btn-modal-ai-close">✕</button>
            </header>
            <div class="modal-body flex flex-col gap-6 my-4">
              <div class="form-group">
                <label class="form-label" for="select-p-type">Provider Platform</label>
                <select class="select capitalize" id="select-p-type" ${activeModalData.mode === 'edit' ? 'disabled' : ''}>
                  <option value="gemini" ${activeModalData.provider === 'gemini' ? 'selected' : ''}>Gemini (Google AI Studio)</option>
                  <option value="groq" ${activeModalData.provider === 'groq' ? 'selected' : ''}>Groq (Fast AI)</option>
                  <option value="nvidia" ${activeModalData.provider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM (Llama 3.1 70B)</option>
                  <option value="openrouter" ${activeModalData.provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Auto / Multi-Model)</option>
                  <option value="mock" ${activeModalData.provider === 'mock' ? 'selected' : ''}>Mock (Deterministic Testing)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="input-p-key">API Key</label>
                <input class="input mono text-sm" type="password" id="input-p-key" value="${escapeHtml(activeModalData.api_key)}" placeholder="Enter API Key (leave unchanged to keep masked ****)">
                <span class="form-hint">Stored securely. Unmasked only in active runtime memory during extraction.</span>
              </div>

              <div class="form-group">
                <div class="flex items-center justify-between mb-2">
                  <label class="form-label mb-0" for="select-p-model">Active Model</label>
                  <button class="btn btn--ghost p-1 text-xs flex items-center gap-1" id="btn-refresh-models" ${refreshingModels ? 'disabled' : ''}>
                    ${refreshingModels ? `<div class="spinner spinner--small"></div> Fetching...` : `🔄 Refresh Models`}
                  </button>
                </div>
                <select class="select mono text-sm" id="select-p-model">
                  ${(availableModels[activeModalData.provider] || [activeModalData.model]).map(m => `
                    <option value="${escapeHtml(m)}" ${activeModalData.model === m ? 'selected' : ''}>${escapeHtml(m)}</option>
                  `).join('')}
                </select>
                <span class="form-hint">Select from known built-in defaults or trigger live discovery to fetch active provider models.</span>
              </div>

              <div class="grid grid--2 gap-4 pt-2 border-t border-subtle">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" id="check-p-enabled" ${activeModalData.enabled ? 'checked' : ''}>
                  <span class="text-sm font-semibold">Provider Enabled</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" id="check-p-fallback" ${activeModalData.fallback_enabled ? 'checked' : ''}>
                  <span class="text-sm font-semibold">Authorize as Fallback Target</span>
                </label>
              </div>
            </div>
            <div class="modal-footer flex items-center justify-end gap-3">
              <button class="btn btn--ghost" id="btn-modal-ai-cancel">Cancel</button>
              <button class="btn btn--primary" id="btn-modal-ai-save">Save Provider</button>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  attachListeners(container);
  aiSigLast = aiRenderSignature(state);
}

function attachListeners(container) {
  const { ai } = store.settings;
  const providers = ai.providers || [];

  container.querySelector('#btn-retry-ai')?.addEventListener('click', async () => {
    viewError = null;
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
    actions.setLoading(true);
    const res = await api.getAiProviders();
    actions.setLoading(false);
    if (res.success) {
      actions.setAiProviders(res.data.providers || []);
    } else {
      viewError = res.error?.message || 'Failed to sync AI provider registry.';
    }
    const c2 = document.getElementById('view-container');
    if (c2) render(c2, store);
  });

  container.querySelector('#btn-add-provider')?.addEventListener('click', () => {
    activeModalData = {
      mode: 'add',
      id: `p_${Date.now()}`,
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      api_key: '',
      enabled: true,
      fallback_enabled: true
    };
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
  });

  container.querySelector('#btn-add-first-provider')?.addEventListener('click', () => {
    container.querySelector('#btn-add-provider')?.click();
  });

  // Modal actions
  container.querySelector('#btn-modal-ai-close')?.addEventListener('click', () => {
    activeModalData = null;
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
  });

  container.querySelector('#btn-modal-ai-cancel')?.addEventListener('click', () => {
    activeModalData = null;
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
  });

  container.querySelector('#select-p-type')?.addEventListener('change', (e) => {
    if (!activeModalData) return;
    activeModalData.provider = e.target.value;
    const defaults = { gemini: 'gemini-2.5-pro', groq: 'llama-3.3-70b-versatile', mock: 'mock' };
    activeModalData.model = defaults[activeModalData.provider] || 'mock';
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);
  });

  container.querySelector('#btn-refresh-models')?.addEventListener('click', async () => {
    if (!activeModalData || refreshingModels) return;
    refreshingModels = true;
    aiSigLast = '';
    const el = document.getElementById('view-container');
    if (el) render(el, store);

    const pType = container.querySelector('#select-p-type')?.value || activeModalData.provider;
    const pKeyInput = container.querySelector('#input-p-key')?.value;
    const pKey = pKeyInput && pKeyInput !== '****' ? pKeyInput : activeModalData.api_key;

    actions.addToast({ type: 'info', message: `Discovering live models for ${pType}...` });
    const res = await api.refreshAiModels(pType, pKey, activeModalData.id);
    refreshingModels = false;

    if (res.success) {
      actions.addToast({ type: 'success', message: `Successfully refreshed ${pType} models.` });
      actions.setAvailableModels(pType, res.data.models);
      if (activeModalData) {
        activeModalData.model = res.data.default_model || res.data.models[0];
      }
    } else {
      actions.addToast({ type: 'error', message: `Model discovery failed: ${res.error?.message || 'Unknown error'}` });
    }
    aiSigLast = '';
    const c2 = document.getElementById('view-container');
    if (c2) render(c2, store);
  });

  container.querySelector('#btn-modal-ai-save')?.addEventListener('click', async () => {
    if (!activeModalData) return;
    const pType = container.querySelector('#select-p-type')?.value || activeModalData.provider;
    const pKeyInput = container.querySelector('#input-p-key')?.value || '';
    const pModel = container.querySelector('#select-p-model')?.value || activeModalData.model;
    const pEnabled = container.querySelector('#check-p-enabled')?.checked ?? true;
    const pFallback = container.querySelector('#check-p-fallback')?.checked ?? true;

    const newProvider = {
      id: activeModalData.id,
      provider: pType,
      model: pModel,
      api_key: pKeyInput && pKeyInput !== '****' ? pKeyInput : activeModalData.api_key,
      enabled: pEnabled,
      priority: activeModalData.mode === 'add' ? providers.length + 1 : activeModalData.priority,
      fallback_enabled: pFallback
    };

    let updatedList = [];
    if (activeModalData.mode === 'add') {
      updatedList = [...providers, newProvider];
    } else {
      updatedList = providers.map(p => p.id === activeModalData.id ? { ...p, ...newProvider } : p);
    }

    actions.setLoading(true);
    const res = await api.saveAiProviders(updatedList);
    actions.setLoading(false);

    if (res.success) {
      actions.addToast({ type: 'success', message: `Successfully saved AI provider.` });
      actions.setAiProviders(res.data.providers || []);
      activeModalData = null;
    } else {
      actions.addToast({ type: 'error', message: `Failed to save provider: ${res.error?.message || 'Unknown error'}` });
    }
    aiSigLast = '';
    const c2 = document.getElementById('view-container');
    if (c2) render(c2, store);
  });

  // Per-card actions
  container.querySelectorAll('.btn-edit-p').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const target = providers.find(p => p.id === id);
      if (!target) return;
      activeModalData = {
        mode: 'edit',
        ...target
      };
      aiSigLast = '';
      const el = document.getElementById('view-container');
      if (el) render(el, store);
    });
  });

  container.querySelectorAll('.btn-test-p').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const target = providers.find(p => p.id === id);
      if (!target || testingId) return;

      testingId = id;
      aiSigLast = '';
      const el = document.getElementById('view-container');
      if (el) render(el, store);

      actions.addToast({ type: 'info', message: `Testing ${target.provider} connection...` });
      const res = await api.testAiProvider(target);
      testingId = null;

      if (res.success) {
        actions.addToast({ type: 'success', message: `${target.provider} connection healthy (${res.data.model}).` });
      } else {
        actions.addToast({ type: 'error', message: `${target.provider} connection failed: ${res.error?.message || 'Unknown error'}` });
      }
      aiSigLast = '';
      const c2 = document.getElementById('view-container');
      if (c2) render(c2, store);
    });
  });

  container.querySelectorAll('.btn-del-p').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const target = providers.find(p => p.id === id);
      if (!target) return;

      if (!confirm(`Are you sure you want to remove ${target.provider} (${target.model}) from the registry?`)) return;

      const filtered = providers.filter(p => p.id !== id);
      filtered.forEach((p, index) => { p.priority = index + 1; });

      actions.setLoading(true);
      const res = await api.saveAiProviders(filtered);
      actions.setLoading(false);

      if (res.success) {
        actions.addToast({ type: 'success', message: `Removed AI provider.` });
        actions.setAiProviders(res.data.providers || []);
      } else {
        actions.addToast({ type: 'error', message: `Failed to remove provider: ${res.error?.message || 'Unknown error'}` });
      }
      aiSigLast = '';
      const c2 = document.getElementById('view-container');
      if (c2) render(c2, store);
    });
  });

  container.querySelectorAll('.btn-prio-up').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const idx = providers.findIndex(p => p.id === id);
      if (idx <= 0) return;

      const newIds = providers.map(p => p.id);
      const temp = newIds[idx - 1];
      newIds[idx - 1] = newIds[idx];
      newIds[idx] = temp;

      actions.setLoading(true);
      const res = await api.reorderAiProviders(newIds);
      actions.setLoading(false);

      if (res.success) {
        actions.addToast({ type: 'success', message: `Priority updated successfully.` });
        actions.setAiProviders(res.data.providers || []);
      } else {
        actions.addToast({ type: 'error', message: `Failed to reorder: ${res.error?.message || 'Unknown error'}` });
      }
      aiSigLast = '';
      const c2 = document.getElementById('view-container');
      if (c2) render(c2, store);
    });
  });

  container.querySelectorAll('.btn-prio-down').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const idx = providers.findIndex(p => p.id === id);
      if (idx === -1 || idx === providers.length - 1) return;

      const newIds = providers.map(p => p.id);
      const temp = newIds[idx + 1];
      newIds[idx + 1] = newIds[idx];
      newIds[idx] = temp;

      actions.setLoading(true);
      const res = await api.reorderAiProviders(newIds);
      actions.setLoading(false);

      if (res.success) {
        actions.addToast({ type: 'success', message: `Priority updated successfully.` });
        actions.setAiProviders(res.data.providers || []);
      } else {
        actions.addToast({ type: 'error', message: `Failed to reorder: ${res.error?.message || 'Unknown error'}` });
      }
      aiSigLast = '';
      const c2 = document.getElementById('view-container');
      if (c2) render(c2, store);
    });
  });
}

export async function onActivate() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  aiDelegatesAbort?.abort();
  aiDelegatesAbort = new AbortController();

  aiSigLast = '';
  unsubscribe = subscribe((state) => {
    const el = document.getElementById('view-container');
    if (!el || state.app.route !== '/ai') return;
    const sig = aiRenderSignature(state);
    if (sig == null) return;
    if (sig === aiSigLast) return;
    aiSigLast = sig;
    render(el, state);
  });

  viewError = null;
  actions.setLoading(true);
  const res = await api.getAiProviders();
  actions.setLoading(false);

  if (res.success) {
    actions.setAiProviders(res.data.providers || []);
    const container = document.getElementById('view-container');
    if (container) render(container, store);
  } else {
    viewError = res.error?.message || 'Failed to fetch AI providers.';
    const container = document.getElementById('view-container');
    if (container) render(container, store);
  }
}

export function onDeactivate() {
  aiDelegatesAbort?.abort();
  aiDelegatesAbort = null;
  if (unsubscribe) unsubscribe();
  aiSigLast = '';
  activeModalData = null;
  testingId = null;
  refreshingModels = false;
}
