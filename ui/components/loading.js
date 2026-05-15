/**
 * ProofPost V1.1 — Loading Component
 * ui/components/loading.js
 */

export class PPLoading extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const type = this.getAttribute('type') || 'spinner';
    
    if (type === 'skeleton') {
      const rows = parseInt(this.getAttribute('rows') || '3');
      let skeletons = '';
      for (let i = 0; i < rows; i++) {
        skeletons += `<div class="skeleton skeleton-text" style="width: ${80 + Math.random() * 20}%"></div>`;
      }
      this.innerHTML = `<div class="skeleton-group" role="status" aria-busy="true" aria-label="Loading content...">${skeletons}</div>`;
    } else {
      const label = this.getAttribute('label') || 'Loading...';
      this.innerHTML = `
        <div class="loading-spinner" role="status" aria-live="polite" aria-label="${label}">
          <div class="spinner"></div>
          ${this.hasAttribute('label') ? `<span class="text-xs text-muted mt-2">${label}</span>` : ''}
        </div>
      `;
    }
  }
}

customElements.define('pp-loading', PPLoading);
