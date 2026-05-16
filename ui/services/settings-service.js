/**
 * ProofPost V1.1 — Settings Service
 * ui/services/settings-service.js
 * 
 * Encapsulates business logic, AI model coercion, and API orchestration for settings.
 */

import { api } from '../api.js';
import { store, actions } from '../store.js';
import { normalizeAiSettings } from '../ai-defaults.js';

/**
 * Fetch settings and update store
 * @returns {Promise<object>} API response
 */
export async function fetchSettingsService() {
  const res = await api.getSettings();
  if (res.success) {
    actions.updateSettings(res.data);
  }
  return res;
}

/**
 * Check AI settings drift and auto-correct
 * @param {object} prevAi
 * @returns {Promise<void>}
 */
export async function checkAiDriftService(prevAi) {
  if (!prevAi) return;
  const normalized = normalizeAiSettings(store.settings.ai);
  if (normalized.model !== prevAi.model || normalized.provider !== prevAi.provider) {
    const saveRes = await api.saveSettings({
      ai: {
        provider: normalized.provider,
        model: normalized.model,
        api_key: prevAi.api_key === '****' ? '****' : (prevAi.api_key || '')
      }
    });
    if (saveRes.success) {
      await fetchSettingsService();
      actions.addToast({ type: 'info', message: 'AI model was corrected to match the selected provider and saved.' });
    } else {
      actions.updateSettings({ ai: normalized });
      actions.addToast({ type: 'warning', message: 'AI model was corrected locally; save failed — fix errors and save again.' });
    }
  }
}

/**
 * Save raw JSON settings
 * @param {string} jsonText
 * @returns {Promise<boolean>}
 */
export async function saveRawJsonSettingsService(jsonText) {
  actions.setLoading(true);
  const res = await api.saveSettingsFileRaw(jsonText);
  actions.setLoading(false);

  if (res.success) {
    actions.addToast({ type: 'success', message: 'Raw settings saved and reloaded.' });
    await fetchSettingsService();
    return true;
  } else {
    actions.addToast({ type: 'error', message: `Save failed: ${res.error.message}` });
    return false;
  }
}

/**
 * Save structured settings
 * @param {object} data
 * @returns {Promise<boolean>}
 */
export async function saveStructuredSettingsService(data) {
  actions.setLoading(true);
  const res = await api.saveSettings(data);
  actions.setLoading(false);

  if (res.success) {
    actions.addToast({ type: 'success', message: 'Settings saved successfully.' });
    await fetchSettingsService();
    return true;
  } else {
    actions.addToast({ type: 'error', message: `Save failed: ${res.error.message}` });
    return false;
  }
}

/**
 * Test AI API Key service
 * @param {string} provider
 * @param {string} key
 * @param {string} model
 * @returns {Promise<object>}
 */
export async function testAiKeyService(provider, key, model) {
  const res = await api.testAIKey(provider, key, model);
  if (res.success) {
    actions.addToast({ type: 'success', message: 'AI Connection verified!' });
  } else {
    const msg = res.error?.message || 'Connection failed';
    actions.addToast({ type: 'error', message: `AI Connection failed: ${msg}` });
  }
  return res;
}

/**
 * Load masked JSON for viewing
 * @returns {Promise<object|null>}
 */
export async function loadMaskedSettingsService() {
  const res = await api.getSettings();
  if (!res.success) {
    actions.addToast({ type: 'error', message: 'Could not load settings from the server.' });
    return null;
  }
  return res.data;
}

/**
 * Load raw JSON string for advanced tab
 * @returns {Promise<string|null>}
 */
export async function loadRawSettingsStringService() {
  const res = await api.getSettingsFileRaw();
  if (res.success) {
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
  }
  return null;
}
