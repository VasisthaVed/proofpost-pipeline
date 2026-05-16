/**
 * ProofPost V1.1 — Settings View
 * ui/views/settings.js
 */

import { api } from '../api.js';
import { defaultModelForProvider, normalizeAiSettings } from '../ai-defaults.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';
import {
  fetchSettingsService,
  checkAiDriftService,
  saveRawJsonSettingsService,
  saveStructuredSettingsService,
  testAiKeyService,
  loadMaskedSettingsService,
  loadRawSettingsStringService
} from '../services/settings-service.js';

let unsubscribe = null;
let isLoading = false;
/** Prevents full re-render on unrelated store updates (e.g. toasts), which wiped in-progress form values. */
let lastSettingsRenderSig = '';

function settingsRenderSignature(s) {
  if (s.app.route !== '/settings') return null;
  return JSON.stringify({
    tab: s.ui.activeSettingsTab,
    loading: s.app.loading,
    ai: { provider: s.settings.ai.provider, model: s.settings.ai.model, api_key: s.settings.ai.api_key, providers: s.settings.ai.providers },
    ingestion: { max_payload_size: s.settings.ingestion.max_payload_size },
    dry_run: s.settings.dry_run,
    dev_mode: s.settings.dev_mode,
    platforms: {
      bluesky: { enabled: s.settings.platforms.bluesky.enabled, handle: s.settings.platforms.bluesky.handle, app_password: s.settings.platforms.bluesky.app_password },
      linkedin: { enabled: s.settings.platforms.linkedin.enabled, access_token: s.settings.platforms.linkedin.access_token }
    },
    loaded: s.settings.loaded
  });
}

/**
 * Render the Settings view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const { ui, settings, app } = state;
  const activeTab = ui.activeSettingsTab;

  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>Settings</h1>
          <p class="text-secondary">Configure your publishing pipeline and platform connections.</p>
        </div>
        <div class="view-header__actions flex gap-2 flex-wrap">
          <button type="button" class="btn btn--outline" id="btn-view-saved-json">View saved JSON</button>
          <button type="button" class="btn btn--primary" id="btn-save-settings">
            ${app.loading ? '<pp-loading type="spinner" class="p-0"></pp-loading>' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div class="view-content">
        <div class="settings-layout grid">
          <aside class="settings-sidebar">
            <nav class="nav-list card">
              <button class="nav-item ${activeTab === 'ai' ? 'nav-item--active' : ''}" data-tab="ai">
                <span class="nav-item__icon">🧠</span>
                <span class="nav-item__label">AI Provider</span>
              </button>
              <button class="nav-item ${activeTab === 'platforms' ? 'nav-item--active' : ''}" data-tab="platforms">
                <span class="nav-item__icon">🌐</span>
                <span class="nav-item__label">Platforms</span>
              </button>
              <button class="nav-item ${activeTab === 'ingestion' ? 'nav-item--active' : ''}" data-tab="ingestion">
                <span class="nav-item__icon">📥</span>
                <span class="nav-item__label">Ingestion</span>
              </button>
              <button class="nav-item ${activeTab === 'environment' ? 'nav-item--active' : ''}" data-tab="environment">
                <span class="nav-item__icon">⚙️</span>
                <span class="nav-item__label">Environment</span>
              </button>
              <button class="nav-item ${activeTab === 'advanced' ? 'nav-item--active' : ''}" data-tab="advanced">
                <span class="nav-item__icon">📄</span>
                <span class="nav-item__label">Advanced JSON</span>
              </button>
              <button class="nav-item ${activeTab === 'danger' ? 'nav-item--active' : ''}" data-tab="danger">
                <span class="nav-item__icon">⚠️</span>
                <span class="nav-item__label text-red">Danger Zone</span>
              </button>
            </nav>
          </aside>

          <main class="settings-main flex flex-col gap-6">
            <div class="card p-8">
              ${isLoading ? `
                <pp-loading type="skeleton" rows="10"></pp-loading>
              ` : renderTab(activeTab, settings)}
            </div>
            <div class="card p-6 bg-raised flex items-center justify-between border border-subtle">
              <span class="text-xs text-secondary">Click Save Changes to instantly validate and persist your configurations to disk.</span>
              <button type="button" class="btn btn--primary" id="btn-save-settings-bottom">
                ${app.loading ? '<pp-loading type="spinner" class="p-0"></pp-loading>' : 'Save Changes'}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  `;

  attachListeners(container, activeTab, settings);
}

function renderTab(tab, settings) {
  switch (tab) {
    case 'ai':
      return `
        <div class="tab-pane">
          <div class="mb-8">
            <h2 class="text-lg font-bold mb-1">AI Extraction Provider</h2>
            <p class="text-sm text-secondary">Configure the model used to identify build facts in commit diffs.</p>
          </div>
          
          <div class="space-y-6">
            <div class="grid grid--2 gap-6">
              <div class="form-group">
                <label class="label">Provider</label>
                <select id="set-ai-provider" class="input">
                  <option value="gemini" ${settings.ai.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                  <option value="groq" ${settings.ai.provider === 'groq' ? 'selected' : ''}>Groq (Llama 3)</option>
                  <option value="nvidia" ${settings.ai.provider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM (Llama 3.1 70B)</option>
                  <option value="openrouter" ${settings.ai.provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Auto / Multi-Model)</option>
                  <option value="mock" ${settings.ai.provider === 'mock' ? 'selected' : ''}>Mock (Testing)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="label">Model ID</label>
                <input type="text" id="set-ai-model" class="input" value="${escapeHtml(settings.ai.model || '')}" placeholder="e.g. gemini-1.5-pro">
              </div>
            </div>

            <div class="form-group">
              <label class="label">API Key</label>
              <div class="flex flex-col gap-2">
                <div class="flex gap-2">
                  <input type="password" id="set-ai-key" class="input" placeholder="Enter API key" value="${settings.ai.api_key ? '****' : ''}" autocomplete="off">
                  <button type="button" class="btn btn--outline" id="btn-test-ai">Test</button>
                </div>
                <div id="set-ai-key-error" class="error-text hidden"></div>
                <p class="text-xs text-muted">API keys are encrypted at rest. Use <strong>****</strong> to test or save with the key already on file. Mock ignores keys and does not call external APIs.</p>
              </div>
            </div>
            <p class="text-xs text-secondary m-0">Change provider or model, then use <strong>Save Changes</strong> (top right) to persist. <strong>Test</strong> only checks connectivity — it does not save.</p>
          </div>
        </div>
       `;
    case 'platforms':
      const bsky = settings.platforms?.bluesky || {};
      const li = settings.platforms?.linkedin || {};
      return `
        <div class="tab-pane">
          <div class="mb-8">
            <h2 class="text-lg font-bold mb-1">Platform Connections</h2>
            <p class="text-sm text-secondary">Configure credentials for publishing destinations.</p>
          </div>

          <div class="space-y-8">
            <!-- Bluesky -->
            <div class="card p-6 bg-raised border border-subtle rounded-lg">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">🦋</span>
                  <div>
                    <h3 class="font-bold text-md m-0">Bluesky</h3>
                    <p class="text-xs text-muted m-0">AT Protocol Federation</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-secondary">Enabled</label>
                  <input type="checkbox" id="set-bsky-enabled" ${bsky.enabled ? 'checked' : ''}>
                </div>
              </div>

              <div class="grid grid--2 gap-4">
                <div class="form-group">
                  <label class="label text-xs">Handle</label>
                  <input type="text" id="set-bsky-handle" class="input input--sm" placeholder="e.g. user.bsky.social" value="${escapeHtml(bsky.handle || '')}">
                </div>
                <div class="form-group">
                  <label class="label text-xs">App Password</label>
                  <input type="password" id="set-bsky-password" class="input input--sm" placeholder="xxxx-xxxx-xxxx-xxxx" value="${bsky.app_password ? '****' : ''}">
                </div>
              </div>
              <p class="text-xs text-muted mt-2">App passwords are encrypted at rest. Use <strong>****</strong> to preserve the existing password.</p>
            </div>

            <!-- LinkedIn -->
            <div class="card p-6 bg-raised border border-subtle rounded-lg">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">💼</span>
                  <div>
                    <h3 class="font-bold text-md m-0">LinkedIn</h3>
                    <p class="text-xs text-muted m-0">OAuth 2.0 API</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-secondary">Enabled</label>
                  <input type="checkbox" id="set-li-enabled" ${li.enabled ? 'checked' : ''}>
                </div>
              </div>

              <div class="form-group">
                <label class="label text-xs">Access Token</label>
                <input type="password" id="set-li-token" class="input input--sm w-full" placeholder="Enter OAuth access token" value="${li.access_token ? '****' : ''}">
              </div>
              <p class="text-xs text-muted mt-2">Access tokens are encrypted at rest. Use <strong>****</strong> to preserve the existing token.</p>
            </div>

            <p class="text-xs text-secondary m-0">Click <strong>Save Changes</strong> (top right) to persist platform configurations.</p>
          </div>
        </div>
      `;
    case 'ingestion':
      return `
        <div class="tab-pane">
          <div class="mb-8">
            <h2 class="text-lg font-bold mb-1">Webhook & Ingestion</h2>
            <p class="text-sm text-secondary">Secure your pipeline entry points and coordinate with GitHub.</p>
          </div>
          
          <div class="space-y-8">
            <div class="form-group">
              <label class="label">HMAC Secret</label>
              <div class="flex gap-2 items-center">
                <input type="password" id="set-hmac" class="input flex-1" placeholder="GitHub Webhook Secret" value="${settings.ingestion.hmac_secret ? '****' : ''}" autocomplete="off">
                <button type="button" class="btn btn--outline btn--sm" id="btn-toggle-hmac" title="Show or hide secret">👁</button>
              </div>
              <div id="set-hmac-error" class="error-text hidden mt-1"></div>
              <p class="text-xs text-muted mt-2">Used to verify <code class="mono">X-Hub-Signature-256</code> headers from GitHub. Must match the secret you enter in GitHub’s webhook settings.</p>
            </div>

            <div class="p-6 bg-raised border border-subtle rounded-lg">
              <label class="label text-xs uppercase tracking-wider text-muted mb-2 block">Canonical Webhook URL</label>
              <div class="flex gap-2">
                <input type="text" readonly class="input bg-surface text-secondary font-mono text-xs" value="${window.location.origin}/webhook/github">
                <button type="button" class="btn btn--outline btn--sm" onclick="navigator.clipboard.writeText('${window.location.origin}/webhook/github'); this.textContent='Copied!'">Copy</button>
              </div>
              <p class="text-xs text-muted mt-3">In GitHub: <strong>Settings → Webhooks → Add webhook</strong> → paste this URL, set content type to JSON, enter the same HMAC secret, then save.</p>
            </div>

            <div class="p-6 bg-surface border border-subtle rounded-lg text-sm">
              <div class="font-bold mb-2">Local dev with ngrok</div>
              <ol class="text-xs text-secondary m-0 pl-4 space-y-2 list-decimal">
                <li>Run <code class="mono bg-raised px-1 rounded">ngrok http &lt;port&gt;</code> (same port ProofPost listens on, e.g. 7821).</li>
                <li>Copy the <strong>https://…ngrok…</strong> forwarding URL from ngrok’s UI.</li>
                <li>In GitHub’s webhook URL field, paste your ngrok HTTPS URL with path <code class="mono text-xs">/webhook/github</code> (example: <code class="mono text-xs break-all">https://abc123.ngrok-free.app/webhook/github</code>).</li>
                <li>Use the same HMAC secret here and in GitHub. Redeploy ngrok URLs change unless you use a reserved domain.</li>
              </ol>
            </div>
          </div>
        </div>
      `;
    case 'environment':
      return `
        <div class="tab-pane">
          <div class="mb-8">
            <h2 class="text-lg font-bold mb-1">Environment Settings</h2>
            <p class="text-sm text-secondary">Global switches for safety and debugging.</p>
          </div>
          
          <div class="space-y-4">
            <label class="flex items-start gap-4 p-4 bg-raised border border-subtle rounded-lg cursor-pointer hover:border-brand-primary transition-colors">
              <input type="checkbox" id="set-dry-run" ${settings.dry_run ? 'checked' : ''} class="mt-1">
              <div>
                <div class="font-bold text-sm">Dry Run Mode</div>
                <div class="text-xs text-muted">Simulate publishing logic without making external API calls. Recommended for first-time setup.</div>
              </div>
            </label>

            <label class="flex items-start gap-4 p-4 bg-raised border border-subtle rounded-lg cursor-pointer hover:border-brand-primary transition-colors">
              <input type="checkbox" id="set-dev-mode" ${settings.dev_mode ? 'checked' : ''} class="mt-1">
              <div>
                <div class="font-bold text-sm">Development Mode</div>
                <div class="text-xs text-muted">Bypass security signature verification and enable verbose logging. Do not use in production.</div>
              </div>
            </label>
          </div>
        </div>
      `;
    case 'advanced':
      return `
        <div class="tab-pane h-full flex flex-col gap-6">
          <div class="flex justify-between items-center flex-wrap gap-4 mb-2">
            <div>
              <h2 class="text-lg font-bold mb-1">Configuration State & Raw JSON</h2>
              <p class="text-sm text-secondary">Compare your active runtime memory with the persisted <code class="mono">settings.json</code> file on disk.</p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn--outline btn--sm" id="btn-copy-active">Save Active to Disk</button>
              <button type="button" class="btn btn--outline btn--sm" id="btn-reload-json">Reload from Disk</button>
            </div>
          </div>

          <div class="grid grid--2 gap-6 flex-1 min-h-[450px]">
            <!-- Active Runtime Config -->
            <div class="card p-4 flex flex-col bg-raised border border-subtle">
              <div class="mb-2 flex justify-between items-center">
                <span class="font-bold text-xs uppercase tracking-wider text-muted">Active Runtime (Memory)</span>
                <span class="badge badge--info">Active</span>
              </div>
              <p class="text-xs text-muted mb-3">Currently powering the pipeline. Includes defaults and unsaved form changes.</p>
              <div class="flex-1 relative overflow-auto bg-base p-3 rounded border border-subtle max-h-[500px]">
                <pre id="display-active-json" class="mono text-xs text-secondary m-0 whitespace-pre-wrap"></pre>
              </div>
            </div>

            <!-- Saved settings.json -->
            <div class="card p-4 flex flex-col bg-surface border border-default">
              <div class="mb-2 flex justify-between items-center">
                <span class="font-bold text-xs uppercase tracking-wider text-brand-primary">Saved settings.json (Disk)</span>
                <span class="badge badge--success">Persisted</span>
              </div>
              <p class="text-xs text-muted mb-3">Actual file contents on disk. Edit directly below and click <strong>Save Changes</strong>.</p>
              <div class="flex-1 relative min-h-[300px]">
                <textarea id="set-raw-json" class="input font-mono text-xs w-full h-full p-3 bg-base border border-subtle" style="resize: none;" placeholder="{}"></textarea>
              </div>
            </div>
          </div>

          <div id="set-json-error" class="error-text hidden"></div>
          <p class="text-xs text-muted m-0 mt-2">
            If your saved <code class="mono">settings.json</code> is empty (<code class="mono">{}</code>), ProofPost operates using built-in defaults. Click <strong>Save Active to Disk</strong> to instantly write the active memory configuration to your file.
          </p>
        </div>
      `;
    case 'danger':
      return `
        <div class="tab-pane">
          <div class="mb-8">
            <h2 class="text-lg font-bold text-red mb-1">Danger Zone</h2>
            <p class="text-sm text-secondary">Irreversible destructive actions.</p>
          </div>
          
          <div class="border border-red border-opacity-30 rounded-lg overflow-hidden">
            <div class="p-4 bg-red-bg flex items-center justify-between">
              <div>
                <div class="font-bold text-sm text-red">Reset Onboarding</div>
                <div class="text-xs text-red opacity-80">Relaunch the setup wizard. Your configuration remains preserved.</div>
              </div>
              <button class="btn btn--outline border-red text-red btn--sm" id="btn-reset-onboarding">Reset Wizard</button>
            </div>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

function attachListeners(container, activeTab, settings) {
  const showError = (id, msg) => {
    const el = container.querySelector(`#${id}-error`);
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
    container.querySelector(`#${id}`)?.classList.add('input--error');
  };

  const clearError = (id) => {
    const el = container.querySelector(`#${id}-error`);
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
    container.querySelector(`#${id}`)?.classList.remove('input--error');
  };

  // Tab Switching
  container.querySelectorAll('.nav-item').forEach(tab => {
    tab.addEventListener('click', () => {
      actions.setSettingsTab(tab.getAttribute('data-tab'));
    });
  });

  const providerSelect = container.querySelector('#set-ai-provider');
  const modelInput = container.querySelector('#set-ai-model');
  providerSelect?.addEventListener('change', () => {
    if (modelInput) {
      modelInput.value = defaultModelForProvider(providerSelect.value);
    }
  });

  // View masked JSON
  container.querySelector('#btn-view-saved-json')?.addEventListener('click', async () => {
    const data = await loadMaskedSettingsService();
    if (!data) return;
    actions.setModal({
      title: 'Saved configuration (masked)',
      body: JSON.stringify(data, null, 2),
      bodyIsPre: true,
      confirmLabel: 'Close',
      hideCancel: true,
      onConfirm: () => {}
    });
  });

  container.querySelector('#btn-toggle-hmac')?.addEventListener('click', () => {
    const el = container.querySelector('#set-hmac');
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
  });

  // Raw JSON Editor
  if (activeTab === 'advanced') {
    const textarea = container.querySelector('#set-raw-json');
    const activeDisplay = container.querySelector('#display-active-json');

    const loadRaw = async () => {
      const rawStr = await loadRawSettingsStringService();
      if (rawStr !== null && textarea) textarea.value = rawStr;

      const activeData = await loadMaskedSettingsService();
      if (activeData && activeDisplay) {
        activeDisplay.textContent = JSON.stringify(activeData, null, 2);
      }
    };
    loadRaw();

    container.querySelector('#btn-reload-json')?.addEventListener('click', loadRaw);

    container.querySelector('#btn-copy-active')?.addEventListener('click', async () => {
      const activeData = await loadMaskedSettingsService();
      if (!activeData) return;
      const cleanData = JSON.stringify(activeData, null, 2);
      if (textarea) textarea.value = cleanData;
      actions.addToast({ type: 'info', message: 'Active configuration copied to editor. Click Save Changes to write to disk.' });
    });
  }

  // Save Settings
  const saveHandler = async () => {
    if (activeTab === 'advanced') {
      const jsonText = container.querySelector('#set-raw-json')?.value;
      if (!jsonText) return;
      
      try {
        JSON.parse(jsonText); // Validation
      } catch (e) {
        showError('set-json', `Invalid JSON: ${e.message}`);
        return;
      }

      await saveRawJsonSettingsService(jsonText);
      return;
    }

    const curAi = store.settings.ai;
    const rawAi = {
      provider: container.querySelector('#set-ai-provider')?.value ?? curAi.provider,
      model: container.querySelector('#set-ai-model')?.value ?? curAi.model,
      api_key: container.querySelector('#set-ai-key')?.value ?? (curAi.api_key || '')
    };
    const curP = store.settings.platforms || { bluesky: {}, linkedin: {} };
    const platformsData = {
      bluesky: {
        enabled: container.querySelector('#set-bsky-enabled')?.checked ?? (curP.bluesky?.enabled ?? true),
        handle: container.querySelector('#set-bsky-handle')?.value ?? (curP.bluesky?.handle ?? ''),
        app_password: container.querySelector('#set-bsky-password')?.value ?? (curP.bluesky?.app_password ?? '')
      },
      linkedin: {
        enabled: container.querySelector('#set-li-enabled')?.checked ?? (curP.linkedin?.enabled ?? false),
        access_token: container.querySelector('#set-li-token')?.value ?? (curP.linkedin?.access_token ?? '')
      }
    };
    const curIng = store.settings.ingestion || {};
    const hmacVal = container.querySelector('#set-hmac')?.value;
    const ingestionData = {
      max_payload_size: curIng.max_payload_size
    };
    if (activeTab === 'ingestion') {
      ingestionData.hmac_secret = hmacVal;
    } else if (curIng.hmac_secret) {
      ingestionData.hmac_secret = '****';
    }

    const data = {
      ai: normalizeAiSettings(rawAi),
      ingestion: ingestionData,
      platforms: platformsData,
      dry_run: container.querySelector('#set-dry-run')?.checked,
      dev_mode: container.querySelector('#set-dev-mode')?.checked
    };

    // Simple validation
    let isValid = true;
    if (activeTab === 'ai') {
      if (!data.ai.api_key && settings.ai.provider !== data.ai.provider) {
        showError('set-ai-key', 'API Key is required when changing providers.');
        isValid = false;
      }
    }
    if (activeTab === 'ingestion') {
      if (!data.ingestion.hmac_secret) {
        showError('set-hmac', 'HMAC Secret is required.');
        isValid = false;
      }
    }

    if (!isValid) return;

    await saveStructuredSettingsService(data);
  };
  container.querySelector('#btn-save-settings')?.addEventListener('click', saveHandler);
  container.querySelector('#btn-save-settings-bottom')?.addEventListener('click', saveHandler);

  // Test AI Key
  container.querySelector('#btn-test-ai')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const provider = container.querySelector('#set-ai-provider').value;
    let key = container.querySelector('#set-ai-key').value;

    if (provider !== 'mock' && !String(key).trim()) {
      showError('set-ai-key', 'Enter an API key, or type **** to use the key already saved in settings.json.');
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    clearError('set-ai-key');

    const model =
      (container.querySelector('#set-ai-model')?.value || '').trim() ||
      defaultModelForProvider(provider);

    const res = await testAiKeyService(provider, key, model);
    
    btn.disabled = false;
    btn.textContent = originalText;

    if (!res.success) {
      showError('set-ai-key', res.error?.message || 'Connection failed');
    }
  });

  // Reset Onboarding
  container.querySelector('#btn-reset-onboarding')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the onboarding wizard?')) {
      actions.setSetupComplete(false);
      window.dispatchEvent(new CustomEvent('navigate', { detail: '/setup' }));
    }
  });
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  const container = document.getElementById('view-container');
  lastSettingsRenderSig = '';

  unsubscribe = subscribe((state) => {
    const el = document.getElementById('view-container');
    if (!el || state.app.route !== '/settings') return;
    const sig = settingsRenderSignature(state);
    if (sig == null) return;
    if (sig === lastSettingsRenderSig) return;
    lastSettingsRenderSig = sig;
    render(el, state);
  });

  isLoading = true;
  if (container) render(container, store);

  let res = { success: true, data: store.settings };
  if (!store.app.server_hydrated) {
    res = await fetchSettingsService();
  }
  isLoading = false;

  if (res.success) {
    await checkAiDriftService(res.data?.ai);
  } else if (container) {
    render(container, store);
  }
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
  lastSettingsRenderSig = '';
}
