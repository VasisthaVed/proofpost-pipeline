/**
 * ProofPost V1.1 — Setup Wizard View
 * ui/views/setup.js
 */

import { api } from '../api.js';
import { defaultModelForProvider, normalizeAiSettings } from '../ai-defaults.js';
import { actions, subscribe, store } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let isVerifying = false;
let setupSigLast = '';

function setupRenderSignature(state) {
  const step = state.ui?.setupStep;
  const ai = state.settings?.ai || {};
  const bsky = state.settings?.platforms?.bluesky || {};
  return `${step}__${ai.provider}__${ai.model}__${Boolean(ai.api_key)}__${bsky.enabled}__${bsky.handle}__${Boolean(bsky.app_password)}__${isVerifying}`;
}

/**
 * Render the Setup Wizard
 */
export function render(container, state) {
  const sig = setupRenderSignature(state);
  if (sig === setupSigLast && container.querySelector('.setup-layout')) return;
  setupSigLast = sig;

  const { ui } = state;
  const step = ui.setupStep;

  container.innerHTML = `
    <div class="setup-layout">
      <div class="setup-card card">
        <div class="setup-progress">
          <div class="progress-bar" style="--progress: ${(step / 5) * 100}%"></div>
          <div class="step-indicator">Step ${step} of 5</div>
        </div>

        <div class="setup-content">
          ${renderStep(step, state)}
        </div>

        <div class="setup-footer">
          ${step > 1 && step < 5 ? `<button class="btn btn--ghost" id="btn-prev" ${isVerifying ? 'disabled' : ''}>Back</button>` : '<div></div>'}
          <div class="flex gap-2">
            ${step < 5 ? `
              <button class="btn btn--ghost btn--sm" id="btn-skip">Skip Step</button>
              <button class="btn btn--primary" id="btn-next" ${isVerifying ? 'disabled' : ''}>
                ${isVerifying ? '<pp-loading type="spinner" class="p-0"></pp-loading>' : (step === 1 ? 'Get Started' : 'Continue')}
              </button>
            ` : ''}
            ${step === 5 ? `<button class="btn btn--primary" id="btn-finish">Open Dashboard</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  attachListeners(container, step, state);
}

function renderStep(step, state) {
  switch (step) {
    case 1:
      return `
        <div class="step-welcome text-center">
          <h1 class="text-2xl font-bold mb-4">Welcome to ProofPost</h1>
          <p class="text-secondary mb-8 max-w-md mx-auto">
            The deterministic, human-in-the-loop publishing pipeline for engineering teams. 
            Turn build facts into verified platform posts automatically.
          </p>
          <div class="welcome-illustration mb-8">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-brand">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <p class="text-xs text-muted">Ready to initialize your publishing pipeline?</p>
        </div>
      `;
    case 2:
      return `
        <div class="step-ai">
          <h1 class="text-lg font-bold mb-2">Configure AI Provider</h1>
          <p class="text-sm text-secondary mb-6">ProofPost uses LLMs to extract objective facts from your code commits.</p>
          
          <div class="space-y-4">
            <div class="form-group">
              <label class="label">Provider</label>
              <select id="ai-provider" class="input">
                <option value="gemini" ${state.settings.ai.provider === 'gemini' ? 'selected' : ''}>Google Gemini (Recommended)</option>
                <option value="groq" ${state.settings.ai.provider === 'groq' ? 'selected' : ''}>Groq (Llama 3)</option>
                <option value="nvidia" ${state.settings.ai.provider === 'nvidia' ? 'selected' : ''}>NVIDIA NIM (Llama 3.1 70B)</option>
                <option value="openrouter" ${state.settings.ai.provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Auto / Multi-Model)</option>
                <option value="mock" ${state.settings.ai.provider === 'mock' ? 'selected' : ''}>Mock (Local Debugging)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="label">API Key</label>
              <input type="password" id="ai-key" class="input" placeholder="Paste your API key here" value="${state.settings.ai.api_key ? '****' : ''}">
              <div id="ai-key-error" class="error-text hidden mt-1"></div>
            </div>

            <div class="p-4 bg-raised rounded-lg border border-subtle">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted">Verification required before proceeding.</span>
                <button class="btn btn--outline btn--sm" id="btn-test-ai">Test Connection</button>
              </div>
              <div id="ai-test-result" class="mt-2 text-xs"></div>
            </div>
          </div>
        </div>
      `;
    case 3:
      return `
        <div class="step-platforms">
          <h1 class="text-lg font-bold mb-2">Connect Publishing Targets</h1>
          <p class="text-sm text-secondary mb-6">Where should verified facts be published?</p>
          
          <div class="platform-option mb-6 p-5 bg-raised border border-subtle rounded-lg">
            <div class="flex items-center gap-3 mb-4">
              <span class="text-2xl">🦋</span>
              <div>
                <div class="font-bold">Bluesky</div>
                <div class="text-xs text-muted">Decentralized social network</div>
              </div>
            </div>
            <div class="space-y-4">
              <p class="text-secondary text-sm">Connect your identity to the decentralized web. Bluesky is the recommended platform for V1.1.</p>
              <div class="form-group">
                <label class="label">Bluesky Handle</label>
                <input type="text" id="bsky-handle" class="input" placeholder="e.g. handle.bsky.social" value="${state.settings.platforms?.bluesky?.handle || ''}">
                <div id="bsky-handle-error" class="error-text hidden mt-1"></div>
              </div>
              <div class="form-group">
                <label class="label">App Password</label>
                <input type="password" id="bsky-key" class="input" placeholder="Create in Bluesky Settings > App Passwords" value="${state.settings.platforms?.bluesky?.api_key ? '****' : ''}">
                <div id="bsky-key-error" class="error-text hidden mt-1"></div>
              </div>
              <div class="p-3 bg-raised rounded border border-subtle">
                <p class="text-xs text-muted m-0"><strong>Pro-Tip:</strong> Never use your main password. Create a unique App Password in your Bluesky account settings for ProofPost.</p>
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between pt-4 border-t border-subtle">
              <span class="text-xs text-muted">Connection test recommended.</span>
              <button class="btn btn--outline btn--sm" id="btn-test-bsky">Verify Bluesky</button>
            </div>
            <div id="bsky-test-result" class="mt-2 text-xs"></div>
          </div>
          
          <p class="text-xs text-muted italic">Note: LinkedIn and Mastodon support coming in V1.2.</p>
        </div>
      `;
    case 4:
      return `
        <div class="step-github">
          <h1 class="text-lg font-bold mb-2">Listen for Activity</h1>
          <p class="text-sm text-secondary mb-6">Configure GitHub webhooks to trigger the pipeline.</p>
          
          <div class="webhook-info p-5 bg-raised border border-subtle rounded-lg mb-6">
            <div class="flex items-center justify-between mb-4 pb-4 border-b border-subtle">
              <div class="flex items-center gap-2">
                <div id="ngrok-indicator" class="w-2 h-2 rounded-full bg-secondary"></div>
                <span class="text-sm font-bold" id="ngrok-status-text">Checking ngrok tunnel...</span>
              </div>
              <button class="btn btn--outline btn--sm" id="btn-check-ngrok">Check Tunnel</button>
            </div>
            <label class="label text-xs uppercase tracking-wider text-muted mb-2 block">Webhook Payload URL</label>
            <div class="flex gap-2">
              <input type="text" id="webhook-url" readonly class="input bg-surface text-secondary mono text-xs" value="${window.location.origin}/webhook/github">
              <button class="btn btn--outline btn--sm" id="btn-copy-webhook">Copy</button>
            </div>
            <p class="text-xs text-brand font-bold mt-3 hidden m-0" id="ngrok-success-note">✓ ngrok tunnel detected! Paste the URL above directly into your GitHub Repository > Settings > Webhooks.</p>
          </div>

          <div class="github-instructions text-sm bg-surface p-5 border border-subtle rounded-lg">
            <div class="font-bold mb-3 flex items-center gap-2">
              <span>🛠️</span> Local Development Guide
            </div>
            <p class="text-xs text-muted mb-4">If running ProofPost on localhost, you need a tunnel like <b>ngrok</b> to receive webhooks.</p>
            <div class="p-3 bg-raised rounded mono text-xs mb-4">
              # In your terminal:<br>
              ngrok http 7821
            </div>
            <p class="text-xs text-muted m-0">Ensure ngrok is active in your terminal, then click <b>Check Tunnel</b> above to automatically retrieve your public webhook URL.</p>
          </div>
        </div>
      `;
    case 5:
      return `
        <div class="step-ready text-center py-8">
          <div class="text-5xl mb-6">🚀</div>
          <h1 class="text-2xl font-bold mb-4">Pipeline Synchronized</h1>
          <p class="text-secondary mb-8 max-w-sm mx-auto">
            Your ProofPost console is now active. All incoming commits will be analyzed and held for your review.
          </p>
          <div class="p-4 bg-brand-glow text-brand rounded-lg border border-brand-primary border-opacity-30 inline-block">
            <span class="font-bold">✓ AI Verified</span>
            <span class="mx-2">•</span>
            <span class="font-bold">✓ Platforms Linked</span>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

async function attachListeners(container, step, state) {
  const showError = (id, msg) => {
    const el = container.querySelector(`#${id}-error`);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    container.querySelector(`#${id}`)?.classList.add('input--error');
  };

  const clearError = (id) => {
    const el = container.querySelector(`#${id}-error`);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
    container.querySelector(`#${id}`)?.classList.remove('input--error');
  };

  // Next Button Handler
  container.querySelector('#btn-next')?.addEventListener('click', async () => {
    if (step === 1) {
      actions.setSetupStep(2);
      return;
    }

    if (step === 2) {
      const provider = container.querySelector('#ai-provider').value;
      const key = container.querySelector('#ai-key').value;
      
      if (!key) { showError('ai-key', 'API key is required.'); return; }
      
      isVerifying = true;
      render(container, store); // show loading spinner

      try {
        // 1. Verify connection first
        const model = defaultModelForProvider(provider);
        const testRes = await api.testAIKey(provider, key === '****' ? store.settings.ai.api_key : key, model);
        
        if (testRes.success) {
          // 2. Save settings to backend
          const saveRes = await api.saveSettings({
            ai: normalizeAiSettings({ provider, api_key: key, model })
          });
          
          if (saveRes.success) {
            // 3. Update local state and advance
            actions.updateSettings({ ai: normalizeAiSettings({ provider, api_key: key, model }) });
            actions.setSetupStep(3);
          } else {
            showError('ai-key', `Failed to save settings: ${saveRes.error.message}`);
          }
        } else {
          showError('ai-key', testRes.error.message);
        }
      } catch (err) {
        showError('ai-key', 'System error during setup. Check backend logs.');
      } finally {
        isVerifying = false;
        // No need to call render() here as actions.setSetupStep will trigger it via subscribe
        // If we didn't advance, the subscribe won't trigger, so we SHOULD render.
        const state = store;
        if (state.ui.setupStep === 2) render(container, state);
      }
    } else if (step === 3) {
      const handle = container.querySelector('#bsky-handle').value;
      const key = container.querySelector('#bsky-key').value;
      if (!handle) { showError('bsky-handle', 'Handle required.'); return; }
      if (!key) { showError('bsky-key', 'Password required.'); return; }
      
      isVerifying = true;
      render(container, store);

      try {
        const platformData = { 
          platforms: { 
            bluesky: { 
              enabled: true, 
              handle: handle, 
              app_password: key === '****' ? store.settings.platforms.bluesky.app_password : key 
            } 
          } 
        };
        
        const res = await api.saveSettings(platformData);
        if (res.success) {
          actions.updateSettings(platformData);
          actions.setSetupStep(4);
        } else {
          actions.addToast({ type: 'error', message: `Failed to save: ${res.error.message}` });
        }
      } finally {
        isVerifying = false;
        if (store.ui.setupStep === 3) render(container, store);
      }
    } else if (step === 4) {
      actions.setSetupStep(5);
    }
  });

  if (step === 4) {
    const checkNgrok = async () => {
      const btn = container.querySelector('#btn-check-ngrok');
      const ind = container.querySelector('#ngrok-indicator');
      const text = container.querySelector('#ngrok-status-text');
      const input = container.querySelector('#webhook-url');
      const note = container.querySelector('#ngrok-success-note');
      if (!btn || !ind || !text || !input) return;

      btn.disabled = true;
      btn.textContent = 'Checking...';
      const res = await api.getNgrokStatus();
      btn.disabled = false;
      btn.textContent = 'Check Tunnel';

      if (res.success && res.data?.connected && res.data?.public_url) {
        ind.className = 'w-2 h-2 rounded-full bg-brand-primary animate-pulse';
        text.textContent = 'ngrok Tunnel Active'; text.className = 'text-sm font-bold text-brand';
        input.value = `${res.data.public_url}/webhook/github`;
        if (note) note.classList.remove('hidden');
      } else {
        ind.className = 'w-2 h-2 rounded-full bg-red';
        text.textContent = 'ngrok Tunnel Not Detected'; text.className = 'text-sm font-bold text-red';
        input.value = `${window.location.origin}/webhook/github`;
        if (note) note.classList.add('hidden');
      }
    };
    checkNgrok();
    container.querySelector('#btn-check-ngrok')?.addEventListener('click', checkNgrok);
    container.querySelector('#btn-copy-webhook')?.addEventListener('click', (e) => {
      const input = container.querySelector('#webhook-url');
      if (input) {
        navigator.clipboard.writeText(input.value);
        e.target.textContent = 'Copied!';
        setTimeout(() => e.target.textContent = 'Copy', 2000);
      }
    });
  }

  container.querySelector('#btn-prev')?.addEventListener('click', () => {
    actions.setSetupStep(step - 1);
  });

  container.querySelector('#btn-skip')?.addEventListener('click', () => {
    actions.setSetupStep(step + 1);
  });

  container.querySelector('#btn-finish')?.addEventListener('click', () => {
    actions.setSetupComplete(true);
    window.dispatchEvent(new CustomEvent('navigate', { detail: '/dashboard' }));
  });

  // Test AI Connection
  container.querySelector('#btn-test-ai')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const resultEl = container.querySelector('#ai-test-result');
    const provider = container.querySelector('#ai-provider').value;
    const key = container.querySelector('#ai-key').value;

    if (!key) { showError('ai-key', 'Enter key first.'); return; }
    
    btn.disabled = true;
    btn.textContent = 'Testing...';
    
    const model = defaultModelForProvider(provider);
    const res = await api.testAIKey(provider, key === '****' ? store.settings.ai.api_key : key, model);
    
    btn.disabled = false;
    btn.textContent = 'Test Connection';

    if (res.success) {
      resultEl.textContent = '✓ Connection successful!';
      resultEl.className = 'mt-2 text-xs text-brand font-bold';
    } else {
      resultEl.textContent = `✗ ${res.error.message}`;
      resultEl.className = 'mt-2 text-xs text-red font-bold';
    }
  });

  // Test Bluesky Connection
  container.querySelector('#btn-test-bsky')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const resultEl = container.querySelector('#bsky-test-result');
    const handle = container.querySelector('#bsky-handle').value;
    const key = container.querySelector('#bsky-key').value;

    if (!handle || !key) { actions.addToast({ type: 'warning', message: 'Handle and key required.' }); return; }
    
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    const platformData = { 
      platforms: { 
        bluesky: { 
          enabled: true, 
          handle: handle, 
          app_password: key === '****' ? store.settings.platforms?.bluesky?.app_password : key 
        } 
      } 
    };
    await api.saveSettings(platformData);
    actions.updateSettings(platformData);

    const res = await api.testPlatform('bluesky');
    
    btn.disabled = false;
    btn.textContent = 'Verify Bluesky';

    if (res.success) {
      resultEl.textContent = '✓ Bluesky credentials verified!';
      resultEl.className = 'mt-2 text-xs text-brand font-bold';
    } else {
      resultEl.textContent = `✗ ${res.error.message}`;
      resultEl.className = 'mt-2 text-xs text-red font-bold';
    }
  });
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  setupSigLast = '';
  const container = document.getElementById('view-container');
  if (container) render(container, store);

  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/setup') {
      render(container, state);
    }
  });
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
}
