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
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const fetchOptions = {
      ...options,
      headers
    };

    if (fetchOptions.body && typeof fetchOptions.body === 'object') {
      fetchOptions.body = JSON.stringify(filterMaskedValues(fetchOptions.body));
    }

    const response = await fetch(url, fetchOptions);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      // Bridge FastAPI "detail" to Canonical Error Object
      const message = data?.detail || `HTTP Error ${response.status}`;
      const code = data?.code || `API_ERROR_${response.status}`;
      return createError(code, message);
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
   * Settings
   */
  getSettings: () => request('/api/settings'),

  saveSettings: (data) => request('/api/settings', {
    method: 'POST',
    body: data
  })
};
