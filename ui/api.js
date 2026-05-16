/**
 * ProofPost V1.1 — Central API Wrapper
 * ui/api.js
 * 
 * All fetch() calls must originate from this file.
 * Implements canonical error handling and secret masking.
 */

const BASE_URL = window.location.origin;

/**
 * Canonical Error Factory
 * @param {string} code 
 * @param {string} message 
 * @param {string} [target] 
 * @returns {object}
 */
const createError = (code, message, target = null) => ({
  success: false,
  data: null,
  error: { code, message, target }
});

/**
 * Recursive helper to remove masked values (****) from payloads
 * @param {any} obj 
 * @returns {any}
 */
const filterMaskedValues = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(filterMaskedValues);

  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value === '****') return acc;
    acc[key] = filterMaskedValues(value);
    return acc;
  }, {});
};

/**
 * Core Request Wrapper
 * @param {string} endpoint 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const { skipMaskFilter, ...restOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(restOptions.headers || {})
  };

  try {
    const fetchOptions = {
      ...restOptions,
      headers
    };

    if (fetchOptions.body !== undefined && fetchOptions.body !== null) {
      if (typeof fetchOptions.body === 'string') {
        fetchOptions.body = fetchOptions.body;
      } else if (typeof fetchOptions.body === 'object') {
        const payload = skipMaskFilter ? fetchOptions.body : filterMaskedValues(fetchOptions.body);
        fetchOptions.body = JSON.stringify(payload);
      }
    }

    const response = await fetch(url, fetchOptions);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      // Bridge FastAPI "detail" to Canonical Error Object
      let message = data?.detail || `HTTP Error ${response.status}`;
      if (typeof message === 'object') message = JSON.stringify(message);
      
      const code = data?.code || `API_ERROR_${response.status}`;
      return createError(code, message);
    }

    // Check for logical success if the backend returns a { success, message } pattern
    if (isJson && data && typeof data.success === 'boolean' && data.success === false) {
      let message = data.message || 'Operation failed';
      if (typeof message === 'object') message = JSON.stringify(message);
      return createError(data.code || 'LOGICAL_ERROR', message);
    }

    return {
      success: true,
      data,
      error: null
    };
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      return createError('NETWORK_OFFLINE', 'The backend server is unreachable. Please ensure ProofPost is running.');
    }
    return createError('INTERNAL_CLIENT_ERROR', err.message);
  }
}

/**
 * API Export Object
 */
export const api = {
  /**
   * Health Check
   */
  getHealth: () => request('/health'),

  /**
   * Workspace / Facts
   */
  getPendingFacts: () => request('/api/facts/pending'),

  approveFact: (id, summary) => request(`/api/facts/${id}/approve`, {
    method: 'POST',
    body: summary ? { summary } : {}
  }),

  rejectFact: (id) => request(`/api/facts/${id}/reject`, {
    method: 'POST'
  }),

  getPreview: (id, platform) => request(`/api/facts/${id}/preview?platform=${platform}`),

  /**
   * Observability
   */
  getEvents: () => request('/api/events'),

  /**
   * History
   */
  getHistory: () => request('/api/history'),

  /**
   * Platforms
   */
  getPlatforms: () => request('/api/platforms'),

  testPlatform: (id) => request(`/api/platforms/${id}/test`, {
    method: 'POST'
  }),

  /**
   * Settings & Verification
   */
  getSettings: () => request('/api/settings'),

  getSettingsFileRaw: () => request('/api/settings/file'),

  saveSettingsFileRaw: (jsonText) => request('/api/settings/file', {
    method: 'POST',
    body: jsonText,
    headers: { 'Content-Type': 'application/json' }
  }),

  saveSettings: (data) => request('/api/settings', {
    method: 'POST',
    body: data
  }),

  testAIKey: (provider, apiKey, model = null) => request('/api/settings/test-ai', {
    method: 'POST',
    body: { provider, api_key: apiKey, model },
    skipMaskFilter: true
  }),

  /**
   * AI Provider Management
   */
  getAiProviders: () => request('/api/ai/providers'),

  saveAiProviders: (providers) => request('/api/ai/providers', {
    method: 'POST',
    body: { providers },
    skipMaskFilter: true
  }),

  testAiProvider: (provider) => request('/api/ai/providers/test', {
    method: 'POST',
    body: provider,
    skipMaskFilter: true
  }),

  reorderAiProviders: (providerIds) => request('/api/ai/providers/reorder', {
    method: 'POST',
    body: { provider_ids: providerIds }
  }),

  refreshAiModels: (provider, apiKey, configId) => request('/api/ai/providers/models', {
    method: 'POST',
    body: { provider, api_key: apiKey, model: configId },
    skipMaskFilter: true
  }),  getNgrokStatus: () => request('/api/ngrok/status'),

  getAiStatus: () => request('/api/ai/status')
};
