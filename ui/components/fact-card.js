/**
 * ProofPost V1.1 — Fact Card Component
 * ui/components/fact-card.js
 */

import { escapeHtml } from '../utils.js';

export class PPFactCard extends HTMLElement {
  constructor() {
    super();
    this._fact = null;
    this._active = false;
  }

  set fact(val) {
    this._fact = val;
    this.render();
  }

  set active(val) {
    this._active = Boolean(val);
    this.render();
  }

  connectedCallback() {
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
    
    this.addEventListener('click', () => this.select());
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.select();
      }
    });
  }

  select() {
    if (this._fact) {
      this.dispatchEvent(new CustomEvent('pp-select', { 
        detail: { id: this._fact.id },
        bubbles: true 
      }));
    }
  }

  getConfidenceClass(score) {
    if (score >= 0.9) return 'status-green';
    if (score >= 0.7) return 'status-amber';
    return 'status-red';
  }

  render() {
    if (!this._fact) return;

    const f = this._fact;
    this.className = `fact-item ${this._active ? 'fact-item--active' : ''}`;
    this.setAttribute('data-fact-id', f.id);
    this.setAttribute('aria-pressed', this._active);
    this.setAttribute('aria-label', `Fact: ${f.summary} from ${f.source_repo}`);

    this.innerHTML = `
      <div class="flex justify-between items-start">
        <span class="badge badge--info">${escapeHtml(f.fact_type)}</span>
        <span class="text-xs mono ${this.getConfidenceClass(f.confidence_score)}">
          ${(f.confidence_score * 100).toFixed(0)}% Confidence
        </span>
      </div>
      <p class="fact-item__summary mt-2">${escapeHtml(f.summary)}</p>
      <div class="fact-item__meta mt-2">
        <span class="text-xs text-muted mono">${escapeHtml(f.source_repo)}</span>
      </div>
    `;
  }
}

customElements.define('pp-fact-card', PPFactCard);
