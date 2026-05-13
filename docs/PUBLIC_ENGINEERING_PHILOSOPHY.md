# Public Engineering Philosophy

## Why ProofPost?

ProofPost was built to solve a specific friction point in modern engineering: the gap between high-velocity development and professional public communication. As software development speeds up, the burden of manually summarizing and publishing updates often leads to "communication debt"—where valuable work remains invisible to the public and stakeholders.

We believe that **engineering activity is the highest-fidelity signal of a project's health.** ProofPost is designed to capture that signal and transform it into high-quality communication without compromising on accuracy or security.

## The Human-In-The-Loop Doctrine

In the age of generative AI, the temptation to automate communication entirely is strong. ProofPost explicitly rejects this path. 

**AI is non-authoritative.** While Large Language Models (LLMs) are excellent at distilling technical complexity and draftsmanship, they are prone to hallucinations and lack the context of strategic intent. In ProofPost, the human operator is the authoritative gatekeeper. 

Our philosophy is: **AI extracts, Human verifies, Human publishes.**

## Deterministic Verification

To combat AI hallucinations, we employ a **Verification-First** architecture. Every fact extracted by the LLM is deterministically matched against the raw source material (commit messages, diffs, build logs) using standard string-matching and regular expression logic. 

A fact that cannot be verified against the ground truth is marked with a low confidence score or rejected. This ensures that the system remains grounded in objective reality.

## Local-First Trust

ProofPost is infrastructure-oriented. We believe that your engineering metadata and publishing credentials should stay under your control. 

- **Authoritative Persistence**: All state is stored in a local SQLite database.
- **Credential Safety**: Secrets are managed locally in `settings.json` and are masked in all API responses and UI views.
- **Zero-Cloud Dependency**: Aside from the LLM provider API, the entire system runs on your hardware.

## AI-Assisted Development Lessons

ProofPost itself was built using advanced agentic coding workflows. This experience taught us several lessons about the future of software engineering:

1.  **Architecture over Syntax**: When working with AI agents, the most critical skill is defining clean, modular interfaces and strict data contracts.
2.  **Governance as Guardrails**: We used internal governance docs (Constitutions, API Contracts) to keep both human and AI contributors aligned on the system's "Ground Truth."
3.  **The Operator Loop**: Just as ProofPost requires human approval for posts, AI-assisted coding requires human review of every commit. The operator's role shifts from "writing" to "orchestrating and auditing."

## Runtime Trust Philosophy

ProofPost assumes a trusted operator environment. It is designed as a single-user productivity tool, not a multi-tenant cloud service. Security is focused on protecting the **inbound boundary** (webhooks via HMAC) and the **outbound boundary** (dispatches via managing credentials securely). 

We prioritize **Technical Honesty** over "AI Magic." If the system isn't sure about a fact, it tells you. If a dispatch fails, it gives you the raw error log. We build for engineers who want to know exactly how their tools work.
