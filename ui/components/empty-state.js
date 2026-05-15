/**
 * ProofPost V1.1 — Empty State Component
 * ui/components/empty-state.js
 */

export class PPEmptyState extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const icon = this.getAttribute('icon') || '📥';
    const title = this.getAttribute('title') || 'No Data';
    const description = this.getAttribute('description') || 'There is nothing to show here.';

    this.innerHTML = `
      <div class="empty-state" role="status">
        <div class="empty-state__icon" aria-hidden="true">${icon}</div>
        <h2 class="empty-state__title text-lg font-bold">${title}</h2>
        <p class="empty-state__description text-secondary">${description}</p>
        <div class="empty-state__actions">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

customElements.define('pp-empty-state', PPEmptyState);
