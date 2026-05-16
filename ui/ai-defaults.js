/**
 * ProofPost V1.1 — Canonical AI provider / model defaults
 * Shared by Settings and Setup for consistent operator truth.
 */

export const AI_DEFAULT_MODEL = {
  gemini: 'gemini-2.5-flash-lite',
  groq: 'llama3-8b-8192',
  nvidia: 'meta/llama-3.3-70b-instruct',
  openrouter: 'openrouter/auto',
  mock: 'mock'
};

/**
 * @param {string} provider
 * @returns {string}
 */
export function defaultModelForProvider(provider) {
  return AI_DEFAULT_MODEL[provider] || AI_DEFAULT_MODEL.mock;
}

/**
 * @param {string} model
 * @param {string} provider
 */
export function modelBelongsToProvider(model, provider) {
  const m = (model || '').trim().toLowerCase();
  if (provider === 'groq') {
    return Boolean(m) && !m.includes('gemini');
  }
  if (provider === 'gemini') {
    return Boolean(m) && m.includes('gemini');
  }
  if (provider === 'nvidia') {
    return Boolean(m);
  }
  if (provider === 'openrouter') {
    return Boolean(m);
  }
  return true;
}

/**
 * Returns a copy of `ai` with provider/model pair normalized.
 * @param {{ provider?: string, model?: string, api_key?: string }} ai
 * @returns {{ provider: string, model: string, api_key?: string }}
 */
export function normalizeAiSettings(ai) {
  const provider = ai.provider || 'mock';
  let model = (ai.model || '').trim();
  if (!modelBelongsToProvider(model, provider)) {
    model = defaultModelForProvider(provider);
  }
  if (!model) {
    model = defaultModelForProvider(provider);
  }
  return { ...ai, provider, model };
}
