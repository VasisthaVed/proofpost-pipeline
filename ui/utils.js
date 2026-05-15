/**
 * ProofPost V1.1 — Utilities
 * ui/utils.js
 */

/**
 * Sanitize string for HTML rendering
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Update Document Title
 * @param {string} viewName 
 */
export function updateTitle(viewName) {
  const name = viewName.charAt(0).toUpperCase() + viewName.slice(1);
  document.title = `ProofPost | ${name}`;
}
