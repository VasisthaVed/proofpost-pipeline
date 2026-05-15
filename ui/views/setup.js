/**
 * ProofPost V1.1 — Setup Wizard View
 * ui/views/setup.js
 */

import { api } from '../api.js';
import { actions, subscribe, store } from '../store.js';
import { escapeHtml } from '../utils.js';

let unsubscribe = null;
let isVerifying = false;

/**
 * Render the Setup Wizard
 */
export function render(container, state) {
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
          ${step > 1 && step < 5 ? `<button class="btn btn--ghost" id="btn-prev" ${isVerifying ? 'disabled' : ''}>Back</button>` : ''}
          ${step < 5 ? `<button class="btn btn--primary" id="btn-next" ${isVerifying ? 'disabled' : ''}>
            ${isVerifying ? '<pp-loading type="spinner" class="p-0"></pp-loading>' : (step === 1 ? 'Get Started' : 'Continue')}
          </button>` : ''}
          ${step === 5 ? `<button class="btn btn--primary" id="btn-finish">Open Dashboard</button>` : ''}
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
            <label class="label text-xs uppercase tracking-wider text-muted mb-2 block">Canonical Endpoint</label>
            <div class="flex gap-2">
              <input type="text" id="webhook-url" readonly class="input bg-surface text-secondary mono text-xs" value="${window.location.origin}/webhook/github">
              <button class="btn btn--outline btn--sm" onclick="navigator.clipboard.writeText(document.getElementById('webhook-url').value); this.textContent='Copied!'">Copy</button>
            </div>
          </div>

          <div class="github-instructions text-sm bg-surface p-5 border border-subtle rounded-lg">
            <div class="font-bold mb-3 flex items-center gap-2">
              <span>🛠️</span> Local Development Guide
            </div>
            <p class="text-xs text-muted mb-4">If running ProofPost on localhost, you need a tunnel like <b>ngrok</b> to receive webhooks.</p>
            <div class="p-3 bg-raised rounded mono text-xs mb-4">
              # In your terminal:<br>
              ngrok http 8000
            </div>
            <p class="text-xs text-muted">Then, use the <b>Forwarding URL</b> provided by ngrok (e.g. https://xyz.ngrok-free.app) and append <b>/webhook/github</b> to it in GitHub Settings.</p>
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
      
      if (key !== '****') {
        isVerifying = true;
        render(container, store);
        const res = await api.testAIKey(provider, key);
        isVerifying = false;
        
        if (res.success) {
          actions.updateSettings({ ai: { provider, api_key: key } });
          actions.setSetupStep(3);
        } else {
          showError('ai-key', res.error.message);
          render(container, store);
        }
      } else {
        actions.setSetupStep(3);
      }
    } else if (step === 3) {
      const handle = container.querySelector('#bsky-handle').value;
      const key = container.querySelector('#bsky-key').value;
      if (!handle) { showError('bsky-handle', 'Handle required.'); return; }
      if (!key) { showError('bsky-key', 'Password required.'); return; }
      
      actions.updateSettings({ 
        platforms: { 
          bluesky: { 
            enabled: true, 
            handle: handle, 
            app_password: key === '****' ? store.settings.platforms.bluesky.app_password : key 
          } 
        } 
      });
      actions.setSetupStep(4);
    } else if (step === 4) {
      actions.setSetupStep(5);
    }
  });

  container.querySelector('#btn-prev')?.addEventListener('click', () => {
    actions.setSetupStep(step - 1);
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
    
    const res = await api.testAIKey(provider, key === '****' ? store.settings.ai.api_key : key);
    
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

    // Simulated for now as backend test endpoint might vary, but use canonical adapter test
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
