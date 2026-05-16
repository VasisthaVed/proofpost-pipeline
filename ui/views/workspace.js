/**
 * ProofPost V1.1 — Workspace View
 * ui/views/workspace.js
 * 
 * The core review workspace where operators inspect evidence and approve facts.
 */

import { api } from '../api.js';
import { store, actions, subscribe } from '../store.js';
import { escapeHtml } from '../utils.js';
import { 
  fetchPendingFactsService, 
  generatePreviewService, 
  approveFactService, 
  rejectFactService 
} from '../services/workspace-service.js';

let unsubscribe = null;
let isLoading = false;

// Preview Integration State
let isGenerating = false;
let generationError = null;

async function loadPreviewForCurrentState() {
  const { workspace } = store;
  if (!workspace.selectedFactId) return;
  
  isGenerating = true;
  generationError = null;
  render(document.getElementById('view-container'), store); // trigger loading UI

  const res = await generatePreviewService(workspace.selectedFactId, workspace.selectedPlatform);
  if (!res.success && res.error) {
    generationError = res.error;
  }
  isGenerating = false;
  render(document.getElementById('view-container'), store);
}

/**
 * Render the Workspace view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  const { workspace, app } = state;
  const facts = workspace.facts || [];
  const selectedFact = facts.find(f => f.id === workspace.selectedFactId);

  container.innerHTML = `
    <div class="workspace-layout">
      <!-- Left Panel: Fact List -->
      <aside class="workspace-sidebar">
        <div class="sidebar-header flex justify-between items-center">
          <span class="label">Pending Review (${facts.length})</span>
          ${facts.length > 0 ? `<span class="text-xs text-muted">J / K to navigate</span>` : ''}
        </div>
        <div class="fact-list">
          ${isLoading ? `
            <div class="p-4 space-y-4">
              <pp-loading type="skeleton" rows="3"></pp-loading>
              <pp-loading type="skeleton" rows="3"></pp-loading>
              <pp-loading type="skeleton" rows="3"></pp-loading>
            </div>
          ` : facts.length === 0 ? `
            <pp-empty-state 
              icon="✅" 
              title="All caught up" 
              description="No facts are currently awaiting review. New events will appear here automatically.">
            </pp-empty-state>
          ` : facts.map(f => `
            <pp-fact-card id="fact-${f.id}"></pp-fact-card>
          `).join('')}
        </div>
      </aside>

      <!-- Right Panel: Review Panel -->
      <section class="workspace-stage">
        ${!selectedFact ? `
          <div class="flex items-center justify-center h-full">
            <pp-empty-state 
              icon="🔍" 
              title="Select a Fact" 
              description="Choose a verified build fact from the list to begin the publication review process.">
            </pp-empty-state>
          </div>
        ` : renderReviewPanel(selectedFact, workspace, app.loading)}
      </section>
    </div>
  `;

  attachListeners(container, selectedFact);
}

function renderReviewPanel(fact, workspace, isAppLoading) {
  const currentDraft = workspace.draftContent[workspace.selectedPlatform] || '';
  const isLargeEdit = checkLargeEdit(currentDraft, workspace.originalContent);
  const hasUnsavedChanges = currentDraft !== workspace.originalContent;
  const charLimit = workspace.selectedPlatform === 'bluesky' ? 300 : 3000;
  const charCount = currentDraft.length;
  const isPreview = workspace.previewMode;

  const cacheKey = `${fact.id}_${workspace.selectedPlatform}`;
  const cacheEntry = workspace.previewCache[cacheKey];

  // 5. Provenance Display
  let provenanceHtml = '';
  if (isGenerating) {
    provenanceHtml = `<pp-loading type="spinner" class="p-0" label="Generating AI Draft..."></pp-loading>`;
  } else if (generationError) {
    provenanceHtml = `<span class="badge badge--error" title="${escapeHtml(generationError)}">AI Failed - Fallback</span>`;
  } else if (cacheEntry?.source === 'error' || cacheEntry?.source === 'fallback') {
    provenanceHtml = `<span class="badge badge--ghost">Original Fact Summary</span>`;
  } else if (cacheEntry?.source === 'ai') {
    provenanceHtml = `<span class="badge badge--info">AI Generated Draft</span>`;
  } else {
    provenanceHtml = `<span class="badge badge--ghost">Awaiting Generation...</span>`;
  }

  return `
    <div class="review-panel">
      <!-- Header -->
      <header class="review-header">
        <div class="flex items-center gap-4">
          <div class="flex flex-col">
            <div class="flex items-center gap-2 mb-1">
              <span class="badge badge--info">${fact.fact_type}</span>
              <span class="text-xs text-muted mono">${escapeHtml(fact.source_commit?.substring(0, 7))}</span>
            </div>
            <h1 class="text-xl font-bold m-0">${escapeHtml(fact.source_repo)}</h1>
          </div>
        </div>
        <div class="flex flex-col items-end">
          <div class="flex items-center gap-2 mb-1">
            <pp-status-dot status="${fact.confidence_score >= 0.9 ? 'online' : fact.confidence_score >= 0.7 ? 'warning' : 'offline'}"></pp-status-dot>
            <span class="text-sm font-semibold">${(fact.confidence_score * 100).toFixed(0)}% Confidence</span>
          </div>
          <span class="text-xs text-muted">Extracted via ProofPost AI</span>
        </div>
      </header>

      <!-- Platform Tabs -->
      <nav class="preview-tabs">
        <button class="tab-item ${workspace.selectedPlatform === 'bluesky' ? 'tab-item--active' : ''}" data-platform="bluesky">
          <span>🦋</span> Bluesky
          ${workspace.draftContent?.bluesky && workspace.draftContent.bluesky !== workspace.originalContent ? '<span class="badge badge--warning text-[10px] ml-1" title="Unsaved local edits">Modified</span>' : ''}
        </button>
        <button class="tab-item ${workspace.selectedPlatform === 'linkedin' ? 'tab-item--active' : ''}" data-platform="linkedin">
          <span>🔗</span> LinkedIn
          ${workspace.draftContent?.linkedin && workspace.draftContent.linkedin !== workspace.originalContent ? '<span class="badge badge--warning text-[10px] ml-1" title="Unsaved local edits">Modified</span>' : ''}
        </button>
        
        <div class="ml-auto flex items-center py-2">
          <button class="btn btn--ghost btn--sm ${isPreview ? 'text-brand font-bold' : ''}" id="btn-toggle-preview" ${isGenerating ? 'disabled' : ''}>
            ${isPreview ? '📝 Edit Draft' : '👁️ View Preview'}
          </button>
        </div>
      </nav>

      <div class="review-content">
        ${isPreview ? renderPreview(currentDraft, workspace.selectedPlatform) : `
          <!-- Editor Section -->
          <div class="editor-section">
            <div class="flex justify-between items-center mb-3">
              <span class="label">Platform Draft</span>
              <div class="flex items-center gap-2">
                ${isGenerating ? provenanceHtml : hasUnsavedChanges ? `
                  <button class="btn btn--ghost btn--sm text-amber" id="btn-reset-draft" title="Reset to ${cacheEntry?.source === 'ai' ? 'AI Original' : 'Fact Summary'}">Reset</button>
                  <span class="badge badge--warning">Modified</span>
                ` : provenanceHtml}
              </div>
            </div>
            
            <div class="editor-container">
              <textarea id="draft-editor" class="editor-textarea" maxlength="${charLimit}" placeholder="Compose your post..." ${isGenerating ? 'disabled' : ''}>${escapeHtml(currentDraft)}</textarea>
              <div class="editor-footer">
                <span class="text-xs ${charCount > charLimit ? 'text-red font-bold' : 'text-muted'}">${charCount} / ${charLimit} characters</span>
                ${isLargeEdit ? '<span class="text-amber text-xs font-semibold">⚠️ Significant modification (>30%)</span>' : ''}
              </div>
            </div>
          </div>

          <!-- Evidence Section -->
          <div class="evidence-section">
            <div class="flex justify-between items-center mb-3">
              <span class="label">Verification Evidence</span>
              <span class="text-xs text-muted">Proof Method: ${escapeHtml(fact.verification_method || 'Semantic')}</span>
            </div>
            <div class="evidence-card">
              <div class="evidence-source">
                <pre><code>${highlightEvidence(fact.source_snippet, fact.verification_match)}</code></pre>
              </div>
              <div class="p-5 bg-raised">
                <div class="text-xs text-muted mb-2 uppercase font-bold tracking-wider">AI Rationale</div>
                <p class="text-sm m-0 text-secondary leading-relaxed">${escapeHtml(fact.verification_rationale || 'Fact extraction was performed with high confidence based on semantic similarity to the source build artifact.')}</p>
              </div>
            </div>
          </div>
        `}
      </div>

      <!-- Actions -->
      <footer class="review-footer">
        <button class="btn btn--ghost mr-auto" id="btn-copy-draft">Copy to Clipboard</button>
        <button class="btn btn--outline" id="btn-reject" ${workspace.dispatching ? 'disabled' : ''}>Discard Fact</button>
        <button class="btn btn--primary" id="btn-approve" ${workspace.dispatching ? 'disabled' : ''} style="min-width: 180px;">
          ${workspace.dispatching ? '<pp-loading type="spinner" class="p-0" label="Dispatching..."></pp-loading>' : 'Approve & Dispatch'}
        </button>
      </footer>
    </div>
  `;
}

function renderPreview(content, platform) {
  const platformName = platform === 'bluesky' ? 'Bluesky' : 'LinkedIn';
  const icon = platform === 'bluesky' ? '🦋' : '🔗';
  
  return `
    <div class="col-span-2 flex flex-col items-center justify-center p-8">
      <div class="mb-6 text-center">
        <h2 class="text-lg font-bold mb-1">${platformName} Preview</h2>
        <p class="text-sm text-muted">Simulated appearance on the target network.</p>
      </div>
      
      <div class="preview-panel ${platform === 'bluesky' ? 'preview-bluesky' : 'preview-linkedin'}">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-raised flex items-center justify-center text-lg">${icon}</div>
          <div>
            <div class="font-bold text-sm">Operator Console</div>
            <div class="text-xs text-muted">@proofpost.system</div>
          </div>
        </div>
        <div class="text-md leading-relaxed whitespace-pre-wrap">${escapeHtml(content || 'No content to preview.')}</div>
        <div class="mt-4 pt-4 border-t border-subtle flex justify-between text-muted text-xs">
          <span>${new Date().toLocaleDateString()}</span>
          <span>ProofPost Verified ✓</span>
        </div>
      </div>
      
      <div class="mt-8">
        <button class="btn btn--outline" id="btn-close-preview">Back to Editor</button>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to the workspace elements
 */
function attachListeners(container, selectedFact) {
  // Fact selection via custom event
  container.addEventListener('pp-select', (e) => {
    actions.selectFact(e.detail.id);
    loadPreviewForCurrentState();
  });

  // Pass data to custom elements
  const facts = store.workspace.facts || [];
  facts.forEach(f => {
    const card = container.querySelector(`#fact-${f.id}`);
    if (card) {
      card.fact = f;
      card.active = f.id === store.workspace.selectedFactId;
    }
  });

  if (!selectedFact) return;

  // Platform switching
  container.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      actions.selectPlatform(tab.getAttribute('data-platform'));
      loadPreviewForCurrentState();
    });
  });

  // Preview toggle
  container.querySelector('#btn-toggle-preview')?.addEventListener('click', () => {
    actions.setPreviewMode(!store.workspace.previewMode);
  });
  
  container.querySelector('#btn-close-preview')?.addEventListener('click', () => {
    actions.setPreviewMode(false);
  });

  // Editor updates
  const editor = container.querySelector('#draft-editor');
  if (editor) {
    editor.addEventListener('input', (e) => {
      actions.updateDraft(e.target.value);
    });
    editor.focus();
  }

  // Reset draft
  container.querySelector('#btn-reset-draft')?.addEventListener('click', () => {
    actions.setModal({
      title: 'Reset to Original',
      body: 'Are you sure you want to discard your edits and restore the original AI-generated draft?',
      confirmLabel: 'Reset Draft',
      onConfirm: () => actions.resetDraft()
    });
  });

  // Copy draft
  container.querySelector('#btn-copy-draft')?.addEventListener('click', (e) => {
    const content = store.workspace.draftContent[store.workspace.selectedPlatform];
    navigator.clipboard.writeText(content);
    const originalText = e.target.textContent;
    e.target.textContent = 'Copied!';
    setTimeout(() => { e.target.textContent = originalText; }, 2000);
  });

  // Approve action
  container.querySelector('#btn-approve')?.addEventListener('click', handleApprove);
  
  // Reject action
  container.querySelector('#btn-reject')?.addEventListener('click', () => {
    actions.setModal({
      title: 'Discard Fact',
      body: 'Are you sure you want to discard this fact? This action cannot be undone and the fact will be removed from the review queue.',
      confirmLabel: 'Discard Permanently',
      onConfirm: () => handleReject()
    });
  });
}

/**
 * Handle Fact Approval
 */
async function handleApprove() {
  const { workspace } = store;
  if (workspace.dispatching || !workspace.selectedFactId) return;

  const currentDraft = workspace.draftContent[workspace.selectedPlatform] || '';
  await approveFactService(workspace.selectedFactId, currentDraft);
}

/**
 * Handle Fact Rejection
 */
async function handleReject() {
  const { workspace } = store;
  if (workspace.dispatching || !workspace.selectedFactId) return;

  await rejectFactService(workspace.selectedFactId);
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  isLoading = true;
  const container = document.getElementById('view-container');
  if (container) render(container, store);

  let res = { success: true, data: { items: store.workspace.facts } };
  if (!store.app.server_hydrated) {
    res = await fetchPendingFactsService();
  }
  isLoading = false;
  
  if (res.success) {
    if (!store.workspace.selectedFactId && res.data?.items?.length > 0) {
      actions.selectFact(res.data.items[0].id);
      loadPreviewForCurrentState();
    }
  } else if (container) {
    render(container, store);
  }

  // Subscribe to store changes to re-render
  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/workspace') {
      render(container, state);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
  document.removeEventListener('keydown', handleKeyboard);
  actions.setPreviewMode(false);
}

/**
 * Keyboard Shortcut Handler
 */
function handleKeyboard(e) {
  // Don't trigger if user is typing in an input or textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.ctrlKey && e.key === 'Enter') {
      handleApprove();
    }
    return;
  }

  const facts = store.workspace.facts || [];
  const currentIndex = facts.findIndex(f => f.id === store.workspace.selectedFactId);

  if (e.key === 'j') {
    const nextIndex = (currentIndex + 1) % facts.length;
    if (facts[nextIndex]) {
      actions.selectFact(facts[nextIndex].id);
      loadPreviewForCurrentState();
    }
  } else if (e.key === 'k') {
    const prevIndex = (currentIndex - 1 + facts.length) % facts.length;
    if (facts[prevIndex]) {
      actions.selectFact(facts[prevIndex].id);
      loadPreviewForCurrentState();
    }
  } else if (e.ctrlKey && e.key === 'Enter') {
    handleApprove();
  }
}

/**
 * Helpers
 */
function checkLargeEdit(draft, original) {
  if (!draft || !original) return false;
  // Simple heuristic: > 30% change in length or content
  const diff = Math.abs(draft.length - original.length);
  return diff > (original.length * 0.3);
}

function highlightEvidence(snippet, match) {
  if (!snippet || !match) return escapeHtml(snippet);
  const escapedSnippet = escapeHtml(snippet);
  const escapedMatch = escapeHtml(match);
  return escapedSnippet.replace(escapedMatch, `<mark>${escapedMatch}</mark>`);
}
