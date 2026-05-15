/**
 * ProofPost V1.1 — Settings View
 * ui/views/settings.js
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let isLoading = false;

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
        <div class="view-header__actions">
          <button class="btn btn--primary" id="btn-save-settings">
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
              <button class="nav-item ${activeTab === 'ingestion' ? 'nav-item--active' : ''}" data-tab="ingestion">
                <span class="nav-item__icon">📥</span>
                <span class="nav-item__label">Ingestion</span>
              </button>
              <button class="nav-item ${activeTab === 'environment' ? 'nav-item--active' : ''}" data-tab="environment">
                <span class="nav-item__icon">⚙️</span>
                <span class="nav-item__label">Environment</span>
              </button>
              <button class="nav-item ${activeTab === 'danger' ? 'nav-item--active' : ''}" data-tab="danger">
                <span class="nav-item__icon">⚠️</span>
                <span class="nav-item__label text-red">Danger Zone</span>
              </button>
            </nav>
          </aside>

          <main class="settings-main">
            <div class="card p-8">
              ${isLoading ? `
                <pp-loading type="skeleton" rows="10"></pp-loading>
              ` : renderTab(activeTab, settings)}
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
                  <input type="password" id="set-ai-key" class="input" placeholder="Enter API key" value="${settings.ai.api_key ? '****' : ''}">
                  <button class="btn btn--outline" id="btn-test-ai">Test</button>
                </div>
                <div id="set-ai-key-error" class="error-text hidden"></div>
                <p class="text-xs text-muted">API keys are encrypted at rest. Leave as **** to keep existing.</p>
              </div>
            </div>
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
              <input type="password" id="set-hmac" class="input" placeholder="GitHub Webhook Secret" value="${settings.ingestion.hmac_secret ? '****' : ''}">
              <div id="set-hmac-error" class="error-text hidden mt-1"></div>
              <p class="text-xs text-muted mt-2">Used to verify X-Hub-Signature-256 headers from GitHub.</p>
            </div>

            <div class="p-6 bg-raised border border-subtle rounded-lg">
              <label class="label text-xs uppercase tracking-wider text-muted mb-2 block">Canonical Webhook URL</label>
              <div class="flex gap-2">
                <input type="text" readonly class="input bg-surface text-secondary font-mono text-xs" value="${window.location.origin}/webhook/github">
                <button class="btn btn--outline btn--sm" onclick="navigator.clipboard.writeText('${window.location.origin}/webhook/github'); this.textContent='Copied!'">Copy</button>
              </div>
              <p class="text-xs text-muted mt-3">Provide this URL to your GitHub repository webhook settings.</p>
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

  // Save Settings
  container.querySelector('#btn-save-settings')?.addEventListener('click', async () => {
    const data = {
      ai: {
        provider: container.querySelector('#set-ai-provider')?.value,
        model: container.querySelector('#set-ai-model')?.value,
        api_key: container.querySelector('#set-ai-key')?.value
      },
      ingestion: {
        hmac_secret: container.querySelector('#set-hmac')?.value
      },
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

    actions.setLoading(true);
    const res = await api.saveSettings(data);
    actions.setLoading(false);

    if (res.success) {
      actions.addToast({ type: 'success', message: 'Settings saved successfully.' });
      const settingsRes = await api.getSettings();
      if (settingsRes.success) actions.updateSettings(settingsRes.data);
    } else {
      actions.addToast({ type: 'error', message: `Save failed: ${res.error.message}` });
    }
  });

  // Test AI Key
  container.querySelector('#btn-test-ai')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const provider = container.querySelector('#set-ai-provider').value;
    const key = container.querySelector('#set-ai-key').value;
    
    if (key === '****') {
      actions.addToast({ type: 'info', message: 'Using existing verified key.' });
      return;
    }
    
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    clearError('set-ai-key');

    const res = await api.testAIKey(provider, key);
    
    btn.disabled = false;
    btn.textContent = originalText;

    if (res.success) {
      actions.addToast({ type: 'success', message: 'AI Connection verified!' });
    } else {
      showError('set-ai-key', res.error.message);
      actions.addToast({ type: 'error', message: 'AI Connection failed.' });
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
  
  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/settings') {
      render(container, state);
    }
  });

  isLoading = true;
  if (container) render(container, store);

  // Refresh settings from API
  const res = await api.getSettings();
  isLoading = false;

  if (res.success) {
    actions.updateSettings(res.data);
  } else if (container) {
    render(container, store);
  }
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
}
