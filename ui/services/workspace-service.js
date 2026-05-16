/**
 * ProofPost V1.1 — Workspace Service
 * ui/services/workspace-service.js
 * 
 * Encapsulates business logic, API orchestration, and store updates for the review workspace.
 */

import { api } from '../api.js';
import { store, actions } from '../store.js';

/**
 * Fetch pending facts and update store
 * @returns {Promise<object>} API response
 */
export async function fetchPendingFactsService() {
  const res = await api.getPendingFacts();
  if (res.success) {
    actions.setPendingFacts(res.data.items);
  }
  return res;
}

/**
 * Check if draft has local edits
 * @param {string} currentDraft
 * @param {string} aiDraft
 * @param {string} factSummary
 * @returns {boolean}
 */
export function hasLocalEditCheck(currentDraft, aiDraft, factSummary) {
  return currentDraft !== aiDraft && currentDraft !== factSummary;
}

/**
 * Handle cached preview
 * @param {object} cached
 * @param {string} platform
 * @param {boolean} hasLocalEdit
 */
export function applyCachedPreview(cached, platform, hasLocalEdit) {
  actions._mutate(() => {
    if (!store.workspace.aiPreview) store.workspace.aiPreview = {};
    store.workspace.aiPreview[platform] = cached.text;
  });
  if (!hasLocalEdit) {
    actions.updateDraft(cached.text);
  }
}

/**
 * Handle API preview success
 * @param {object} res
 * @param {string} factSummary
 * @param {string} cacheKey
 * @param {string} platform
 * @param {boolean} hasLocalEdit
 */
export function handlePreviewSuccess(res, factSummary, cacheKey, platform, hasLocalEdit) {
  const isFallback = res.data.preview_text === factSummary;
  actions.setPreviewCache(cacheKey, {
    text: res.data.preview_text,
    source: isFallback ? 'fallback' : 'ai',
    timestamp: Date.now()
  });
  actions._mutate(() => {
    if (!store.workspace.aiPreview) store.workspace.aiPreview = {};
    store.workspace.aiPreview[platform] = res.data.preview_text;
  });
  if (!hasLocalEdit) {
    actions.updateDraft(res.data.preview_text);
  }
}

/**
 * Handle API preview failure or error
 * @param {string} cacheKey
 * @param {string} factSummary
 * @param {boolean} hasLocalEdit
 */
export function handlePreviewFailure(cacheKey, factSummary, hasLocalEdit) {
  actions.setPreviewCache(cacheKey, { text: factSummary, source: 'error', timestamp: Date.now() });
  if (!hasLocalEdit) {
    actions.updateDraft(factSummary);
  }
}

/**
 * Generate preview service orchestration
 * @param {string} factId
 * @param {string} platform
 * @returns {Promise<object>} Result object with error message if any
 */
export async function generatePreviewService(factId, platform) {
  const fact = store.workspace.facts.find(f => f.id === factId);
  if (!fact) return { success: false, error: 'Fact not found' };

  const cacheKey = `${factId}_${platform}`;
  const currentDraft = store.workspace.draftContent[platform] || '';
  const aiDraft = store.workspace.aiPreview?.[platform] || fact.summary;
  const hasLocalEdit = hasLocalEditCheck(currentDraft, aiDraft, fact.summary);

  if (store.workspace.previewCache[cacheKey]) {
    applyCachedPreview(store.workspace.previewCache[cacheKey], platform, hasLocalEdit);
    return { success: true, cached: true };
  }

  actions.cleanupPreviewCache();
  try {
    const res = await api.getPreview(factId, platform);
    if (res.success) {
      handlePreviewSuccess(res, fact.summary, cacheKey, platform, hasLocalEdit);
      return { success: true, cached: false };
    } else {
      handlePreviewFailure(cacheKey, fact.summary, hasLocalEdit);
      return { success: false, error: res.error?.message || 'AI provider failed' };
    }
  } catch (err) {
    handlePreviewFailure(cacheKey, fact.summary, hasLocalEdit);
    return { success: false, error: 'Network error during AI generation.' };
  }
}

/**
 * Approve fact service orchestration
 * @param {string} factId
 * @param {string} currentDraft
 * @returns {Promise<boolean>}
 */
export async function approveFactService(factId, currentDraft) {
  actions.setDispatching(true);
  const res = await api.approveFact(factId, currentDraft);
  if (res.success) {
    actions.addToast({ type: 'success', message: 'Fact dispatched successfully!' });
    actions.clearDraft(factId);
    await fetchPendingFactsService();
    actions.selectFact(null);
    actions.setPreviewMode(false);
  } else {
    actions.addToast({ type: 'error', message: `Dispatch failed: ${res.error.message}` });
  }
  actions.setDispatching(false);
  return res.success;
}

/**
 * Reject fact service orchestration
 * @param {string} factId
 * @returns {Promise<boolean>}
 */
export async function rejectFactService(factId) {
  const res = await api.rejectFact(factId);
  if (res.success) {
    actions.addToast({ type: 'success', message: 'Fact discarded.' });
    actions.clearDraft(factId);
    await fetchPendingFactsService();
    actions.selectFact(null);
    actions.setPreviewMode(false);
  } else {
    actions.addToast({ type: 'error', message: `Action failed: ${res.error.message}` });
  }
  return res.success;
}
