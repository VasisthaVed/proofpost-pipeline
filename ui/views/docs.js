/**
 * ProofPost V1.1 — Documentation View
 * ui/views/docs.js
 */

import { subscribe } from '../store.js';

let unsubscribe = null;
let observer = null;

/**
 * Render the Docs view
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function render(container, state) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <div class="view-header__title">
          <h1>Operator Manual</h1>
          <p class="text-secondary">Comprehensive guide to ProofPost pipeline architecture, configuration, and operation.</p>
        </div>
      </div>

      <div class="view-content">
        <div class="docs-layout grid">
          <aside class="docs-sidebar">
            <nav class="nav-list card docs-nav-sticky" id="docs-toc">
              <div class="p-4 text-xs font-bold uppercase text-muted tracking-widest">Getting Started</div>
              <a href="#intro" class="nav-item" data-section="intro"><span class="nav-item__label">1. Introduction</span></a>
              <a href="#setup" class="nav-item" data-section="setup"><span class="nav-item__label">2. First-Time Setup</span></a>
              
              <div class="p-4 text-xs font-bold uppercase text-muted tracking-widest">Configuration</div>
              <a href="#webhooks" class="nav-item" data-section="webhooks"><span class="nav-item__label">3. GitHub Webhooks</span></a>
              <a href="#ai-setup" class="nav-item" data-section="ai-setup"><span class="nav-item__label">4. AI Provider Setup</span></a>
              <a href="#platform-setup" class="nav-item" data-section="platform-setup"><span class="nav-item__label">5. Platform Setup</span></a>
              
              <div class="p-4 text-xs font-bold uppercase text-muted tracking-widest">Operations</div>
              <a href="#verification" class="nav-item" data-section="verification"><span class="nav-item__label">6. How Verification Works</span></a>
              <a href="#workflow" class="nav-item" data-section="workflow"><span class="nav-item__label">7. Review Workflow</span></a>
              <a href="#lifecycle" class="nav-item" data-section="lifecycle"><span class="nav-item__label">8. Dispatch Lifecycle</span></a>
              <a href="#philosophy" class="nav-item" data-section="philosophy"><span class="nav-item__label">9. Human-in-the-loop</span></a>
              
              <div class="p-4 text-xs font-bold uppercase text-muted tracking-widest">Support</div>
              <a href="#troubleshooting" class="nav-item" data-section="troubleshooting"><span class="nav-item__label">10. Troubleshooting</span></a>
              <a href="#errors" class="nav-item" data-section="errors"><span class="nav-item__label">11. Common Errors</span></a>
              <a href="#faq" class="nav-item" data-section="faq"><span class="nav-item__label">12. FAQ</span></a>
              <a href="#shortcuts" class="nav-item" data-section="shortcuts"><span class="nav-item__label">13. Keyboard Shortcuts</span></a>
              <a href="#security" class="nav-item" data-section="security"><span class="nav-item__label">14. Security Model</span></a>
              <a href="#telemetry" class="nav-item" data-section="telemetry"><span class="nav-item__label">15. Observability Guide</span></a>
            </nav>
          </aside>

          <main class="docs-main flex flex-col gap-8" style="max-width: var(--content-readable);">
            <!-- Quick Start Card -->
            <section id="quickstart" class="card p-8 bg-brand-glow border-brand-primary">
              <h2 class="mb-4 text-brand-primary">🚀 Quick Start</h2>
              <p class="text-secondary mb-4">Get up and running with ProofPost in less than 5 minutes.</p>
              <div class="grid grid--2 gap-4">
                <div class="p-4 bg-surface rounded border border-subtle">
                  <div class="font-bold mb-1">1. Configure</div>
                  <p class="text-xs text-muted">Set up your AI provider and publishing platforms in the <a href="/setup" data-route="/setup" class="text-brand">Setup Wizard</a>.</p>
                </div>
                <div class="p-4 bg-surface rounded border border-subtle">
                  <div class="font-bold mb-1">2. Connect</div>
                  <p class="text-xs text-muted">Add the ProofPost webhook to your GitHub repository settings.</p>
                </div>
              </div>
            </section>

            <section id="intro" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">1. Introduction</h2>
              <p class="text-secondary leading-relaxed mb-4">
                ProofPost is a <strong>deterministic fact compiler</strong>. It bridges the gap between your private engineering activity and your public professional presence by extracting verified, high-signal "build facts" from your code commits.
              </p>
              <div class="p-4 bg-blue-bg border-l-4 border-blue rounded-r">
                <p class="text-sm text-blue m-0"><strong>Note:</strong> ProofPost is NOT an autonomous agent. It is a tool that proposes; you are the editor who disposes.</p>
              </div>
            </section>

            <section id="setup" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">2. First-Time Setup</h2>
              <p class="text-secondary mb-4">When you first launch ProofPost, the Setup Wizard will guide you through connecting your AI provider and your first publishing platform.</p>
              <div class="p-4 bg-raised rounded border border-subtle">
                <ol class="list-decimal pl-4 space-y-2 text-sm text-secondary">
                  <li>Initialize the AI provider (Gemini or Groq).</li>
                  <li>Connect at least one platform (Bluesky is recommended for V1.1).</li>
                  <li>Configure your GitHub Webhook.</li>
                </ol>
              </div>
            </section>

            <section id="webhooks" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">3. Connecting GitHub Webhooks</h2>
              <p class="text-secondary mb-4">ProofPost listens for code activity via GitHub Webhooks. Follow these steps to connect a repository:</p>
              <div class="p-6 bg-raised rounded border border-subtle">
                <ol class="list-decimal pl-4 space-y-4 text-sm text-secondary">
                  <li>Navigate to your GitHub repository <strong>Settings</strong> > <strong>Webhooks</strong>.</li>
                  <li>Click <strong>Add webhook</strong>.</li>
                  <li>Payload URL: <code class="bg-surface p-1 rounded mono">${window.location.origin}/webhook/github</code></li>
                  <li>Content type: <strong>application/json</strong></li>
                  <li>Secret: Copy the secret from your <a href="/settings" data-route="/settings" class="text-brand">Settings</a> page.</li>
                  <li>Events: Select <strong>Just the push event</strong>.</li>
                </ol>
              </div>
              <div class="p-4 mt-6 bg-amber-bg border-l-4 border-amber rounded-r">
                <p class="text-sm text-amber m-0"><strong>Verification:</strong> If no facts appear after a commit, verify the "Recent Deliveries" tab in your GitHub webhook settings.</p>
              </div>
            </section>

            <section id="ai-setup" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">4. AI Provider Setup</h2>
              <p class="text-secondary mb-4">ProofPost uses Large Language Models to identify "Build Facts" (features, fixes, refactors) within your commit diffs.</p>
              <ul class="list-disc pl-4 space-y-2 text-sm text-secondary">
                <li><strong>Google Gemini:</strong> Recommended for best reasoning performance.</li>
                <li><strong>Groq:</strong> Recommended for near-instant extraction speeds.</li>
              </ul>
            </section>

            <section id="platform-setup" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">5. Platform Setup</h2>
              <p class="text-secondary mb-4">Connect your social and professional networks. In V1.1, we support Bluesky and LinkedIn.</p>
              <div class="p-4 bg-surface border border-subtle rounded">
                <h4 class="text-xs font-bold mb-2">Bluesky Tips</h4>
                <p class="text-xs text-muted">Use an <strong>App Password</strong>, not your main password. Create one in Bluesky Settings > App Passwords.</p>
              </div>
            </section>

            <section id="verification" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">6. How Verification Works</h2>
              <p class="text-secondary mb-4">ProofPost uses a dual-verification strategy:</p>
              <ul class="list-disc pl-4 space-y-2 text-sm text-secondary">
                <li><strong>Semantic Extraction:</strong> Identify facts that match the diff's intent.</li>
                <li><strong>Evidence Grounding:</strong> Every fact must be linked to a specific code snippet.</li>
              </ul>
            </section>

            <section id="workflow" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">7. Review Workflow</h2>
              <p class="text-secondary mb-4">The Workspace is where you perform the "Human-in-the-loop" review:</p>
              <div class="grid grid--2 gap-6 mt-6">
                <div class="p-4 border border-subtle rounded">
                  <h3 class="text-sm font-bold mb-2">Inspect Evidence</h3>
                  <p class="text-xs text-muted">Review the "Verification Evidence" panel. ProofPost highlights the exact lines in the source code that justify the fact.</p>
                </div>
                <div class="p-4 border border-subtle rounded">
                  <h3 class="text-sm font-bold mb-2">Edit Draft</h3>
                  <p class="text-xs text-muted">The AI drafts a post, but you have full control. Edits are saved locally until you dispatch.</p>
                </div>
              </div>
            </section>

            <section id="lifecycle" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">8. Dispatch Lifecycle</h2>
              <p class="text-secondary mb-4">A fact goes through these states:</p>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2"><span class="badge badge--info">Pending</span> <span class="text-xs text-muted">Awaiting your review.</span></div>
                <div class="flex items-center gap-2"><span class="badge badge--success">Dispatched</span> <span class="text-xs text-muted">Published to selected platforms.</span></div>
                <div class="flex items-center gap-2"><span class="badge badge--error">Failed</span> <span class="text-xs text-muted">Network error or API rejection.</span></div>
              </div>
            </section>

            <section id="philosophy" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">9. Human-in-the-loop</h2>
              <p class="text-secondary leading-relaxed">
                ProofPost is built on the philosophy that <strong>automation should empower, not replace</strong>. 
                The "Human Gate" ensures that your professional reputation is never at the mercy of a hallucinating AI.
              </p>
            </section>

            <section id="troubleshooting" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">10. Troubleshooting</h2>
              <p class="text-secondary mb-4">If things aren't working as expected:</p>
              <ul class="list-disc pl-4 space-y-2 text-sm text-secondary">
                <li>Check the <strong>Observability</strong> tab for real-time error logs.</li>
                <li>Verify <strong>HMAC Secrets</strong> match between GitHub and ProofPost.</li>
                <li>Ensure your <strong>AI Provider</strong> has remaining quota.</li>
              </ul>
            </section>

            <section id="errors" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">11. Common Errors</h2>
              <div class="space-y-4">
                <div class="p-3 bg-red-bg border-l-4 border-red rounded-r">
                  <div class="text-xs font-bold text-red mb-1">401 Unauthorized</div>
                  <p class="text-xs m-0 text-red opacity-80">Invalid HMAC signature. Check your webhook secret.</p>
                </div>
                <div class="p-3 bg-red-bg border-l-4 border-red rounded-r">
                  <div class="text-xs font-bold text-red mb-1">413 Payload Too Large</div>
                  <p class="text-xs m-0 text-red opacity-80">The commit diff is too large for the configured AI provider.</p>
                </div>
              </div>
            </section>

            <section id="faq" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">12. FAQ</h2>
              <div class="space-y-6">
                <div>
                  <h4 class="text-sm font-bold mb-2">Does ProofPost publish automatically?</h4>
                  <p class="text-xs text-secondary">No. Every publication requires manual approval. This is a core governance rule of the system.</p>
                </div>
                <div>
                  <h4 class="text-sm font-bold mb-2">Can I connect multiple repositories?</h4>
                  <p class="text-xs text-secondary">Yes. Simply add the same webhook URL and secret to any number of repositories.</p>
                </div>
              </div>
            </section>

            <section id="shortcuts" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">13. Keyboard Shortcuts</h2>
              <div class="p-0 border border-subtle rounded overflow-hidden">
                <table class="w-full text-left text-sm">
                  <thead class="bg-raised">
                    <tr>
                      <th class="p-3 font-bold border-b border-subtle">Command</th>
                      <th class="p-3 font-bold border-b border-subtle">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-subtle">
                      <td class="p-3">Approve & Dispatch</td>
                      <td class="p-3"><kbd class="bg-raised px-2 py-1 rounded border border-default shadow-sm font-mono text-xs">Ctrl + Enter</kbd></td>
                    </tr>
                    <tr class="border-b border-subtle">
                      <td class="p-3">Next Fact</td>
                      <td class="p-3"><kbd class="bg-raised px-2 py-1 rounded border border-default shadow-sm font-mono text-xs">J</kbd></td>
                    </tr>
                    <tr>
                      <td class="p-3">Previous Fact</td>
                      <td class="p-3"><kbd class="bg-raised px-2 py-1 rounded border border-default shadow-sm font-mono text-xs">K</kbd></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="security" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">14. Security Model</h2>
              <p class="text-secondary mb-4">ProofPost is designed for maximum data sovereignty:</p>
              <ul class="list-disc pl-4 space-y-2 text-sm text-secondary">
                <li><strong>Stateless Extraction:</strong> Your code is never stored by ProofPost beyond the extraction window.</li>
                <li><strong>Local Store:</strong> Drafts are stored in your browser's <code>localStorage</code>, not on our servers.</li>
                <li><strong>Secret Masking:</strong> Sensitive keys are never displayed in full once saved.</li>
              </ul>
            </section>

            <section id="telemetry" class="card p-8 scroll-mt-20">
              <h2 class="mb-6">15. Observability Guide</h2>
              <p class="text-secondary">
                The Observability view provides a real-time stream of the pipeline's internal thoughts. 
                You can see exactly when a webhook arrives, which provider was chosen, and any network delays during dispatch.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  `;

  attachListeners(container);
}

/**
 * Attach local listeners for smooth scroll and intersection observing
 * @param {HTMLElement} container 
 */
function attachListeners(container) {
  const toc = container.querySelector('#docs-toc');
  const sections = container.querySelectorAll('main section');
  const navItems = toc.querySelectorAll('.nav-item');

  // 1. Smooth Scroll for TOC links
  toc.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-item');
    if (!link || !link.getAttribute('href').startsWith('#')) return;
    
    e.preventDefault();
    const id = link.getAttribute('href').substring(1);
    const target = container.querySelector(`#${id}`);
    
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // 2. Intersection Observer for Active Highlight
  if (observer) observer.disconnect();

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(item => {
          if (item.getAttribute('href') === `#${id}`) {
            item.classList.add('nav-item--active');
          } else {
            item.classList.remove('nav-item--active');
          }
        });
      }
    });
  }, {
    rootMargin: '-80px 0px -70% 0px',
    threshold: [0, 0.1, 0.5]
  });

  sections.forEach(section => observer.observe(section));
}

/**
 * View Lifecycle
 */
export async function onActivate() {
  unsubscribe = subscribe((state) => {
    const container = document.getElementById('view-container');
    if (container && state.app.route === '/docs') {
      render(container, state);
    }
  });
}

export function onDeactivate() {
  if (unsubscribe) unsubscribe();
  if (observer) observer.disconnect();
}
