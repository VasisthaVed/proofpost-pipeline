# ProofPost — System Inventory & Knowledge Map

This document serves as the authoritative index of all documentation, governance rules, and agentic workflows within the ProofPost repository. It is designed to provide immediate context for both human developers and AI coding assistants.

---

## 🏛️ Core Project Philosophy
**Deterministic Human-In-The-Loop Publishing.**
ProofPost is not an autonomous agent; it is a compiler for engineering activity. 
- **AI extracts:** LLMs identify facts from technical noise.
- **Human verifies:** The operator is the final authority.
- **Human publishes:** Nothing reaches the public without explicit approval.

---

## 🚀 V1.1 Stabilization & UX Cycle (FREEZE)
The current development cycle (V1.1) is now under **Governance Freeze**.
- **Shadow DOM**: Banned. All components use light DOM + BEM-lite.
- **Error Handling**: Canonical Error Object mandated.
- **State**: Reactive Proxy Store with Draft Rehydration.
- **Paths**: Standardized to `docs/v1.1/`.

---

## 📚 Documentation Inventory (`docs/`)

### 🛠️ Authoritative Sources (ACTIVE)
| Domain | Authoritative File | Status |
| :--- | :--- | :--- |
| Backend governance | [constitution.md](file:///c:/Pro/PROJECT/ProofPost/docs/governance/constitution.md) | **ACTIVE** |
| Frontend governance | [UI_ENGINEERING_RULES.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_ENGINEERING_RULES.md) | **ACTIVE** |
| State architecture | [UI_STATE_SCHEMA.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_STATE_SCHEMA.md) | **ACTIVE** |
| Workspace behavior | [WORKSPACE_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/WORKSPACE_SPEC.md) | **ACTIVE** |
| Rendering semantics | [PLATFORM_RENDERING_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/PLATFORM_RENDERING_SPEC.md) | **ACTIVE** |
| Lifecycle rules | [VIEW_LIFECYCLE.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/VIEW_LIFECYCLE.md) | **ACTIVE** |
| Routing rules | [ROUTING_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/ROUTING_SPEC.md) | **ACTIVE** |

### 📋 General & Operational Docs
| File | Description | Status |
| :--- | :--- | :--- |
| [CHANGELOG.md](file:///c:/Pro/PROJECT/ProofPost/docs/CHANGELOG.md) | Project change history. | **ACTIVE** |
| [V1_COMPLETION_PLAN.md](file:///c:/Pro/PROJECT/ProofPost/docs/V1_COMPLETION_PLAN.md) | Criteria for V1.1 sign-off. | **ACTIVE** |
| [OPERATOR_TESTING_GUIDE.md](file:///c:/Pro/PROJECT/ProofPost/docs/OPERATOR_TESTING_GUIDE.md) | Manual verification protocol. | **ACTIVE** |
| [API_CONTRACTS.md](file:///c:/Pro/PROJECT/ProofPost/docs/API_CONTRACTS.md) | Defines all system and operator API endpoints. | **ACTIVE** |
| [KNOWN_ISSUES.md](file:///c:/Pro/PROJECT/ProofPost/docs/KNOWN_ISSUES.md) | Tracks identified architectural and operational gaps. | **ACTIVE** |
| [PUBLIC_ENGINEERING_PHILOSOPHY.md](file:///c:/Pro/PROJECT/ProofPost/docs/PUBLIC_ENGINEERING_PHILOSOPHY.md) | The "Why" behind the project. | **ACTIVE** |
| [ROADMAP.md](file:///c:/Pro/PROJECT/ProofPost/docs/ROADMAP.md) | Future features and development phases. | **ACTIVE** |

### ⚖️ Governance (`docs/governance/`)
| File | Description | Status |
| :--- | :--- | :--- |
| [constitution.md](file:///c:/Pro/PROJECT/ProofPost/docs/governance/constitution.md) | Foundational rules of the system. | **ACTIVE** |
| [system.md](file:///c:/Pro/PROJECT/ProofPost/docs/governance/system.md) | Pipeline flow and module responsibilities. | **ACTIVE** |
| [ai_rules.md](file:///c:/Pro/PROJECT/ProofPost/docs/governance/ai_rules.md) | Operational constraints for AI assistants. | **ACTIVE** |

### 🎨 V1.1 UI/UX Doctrine (`docs/v1.1/`)
| File | Description | Status |
| :--- | :--- | :--- |
| [UI_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_SPEC.md) | Complete V1.1 UI/UX specification. | **ACTIVE** |
| [UI_ENGINEERING_RULES.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_ENGINEERING_RULES.md) | The "Frontend Constitution" for modular ES Modules. | **ACTIVE** |
| [UI_STATE_SCHEMA.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_STATE_SCHEMA.md) | Authoritative frontend state structure. | **ACTIVE** |
| [UI_API_INTEGRATION.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_API_INTEGRATION.md) | Frontend ↔ backend API contracts. | **ACTIVE** |
| [WORKSPACE_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/WORKSPACE_SPEC.md) | Core workspace behavior and layout. | **ACTIVE** |
| [UI_COMPONENT_CATALOG.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/UI_COMPONENT_CATALOG.md) | Approved Web Components list. | **ACTIVE** |
| [VIEW_LIFECYCLE.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/VIEW_LIFECYCLE.md) | Lifecycle contract for frontend views. | **ACTIVE** |
| [WORKSPACE_STATE_MACHINE.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/WORKSPACE_STATE_MACHINE.md) | Fact lifecycle inside the Workspace. | **ACTIVE** |
| [PLATFORM_RENDERING_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/PLATFORM_RENDERING_SPEC.md) | Platform-specific formatting rules. | **ACTIVE** |
| [ROUTING_SPEC.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/ROUTING_SPEC.md) | Authoritative routing rules and guards. | **ACTIVE** |
| [prompt.md](file:///c:/Pro/PROJECT/ProofPost/docs/v1.1/prompt.md) | **Master Implementation Prompts** (Phase-by-phase). | **ACTIVE** |

### 📜 Legacy References (`docs/ui/`)
| File | Description | Status |
| :--- | :--- | :--- |
| [UI_ARCHITECTURE.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_ARCHITECTURE.md) | Legacy single-page UI model overview. | **LEGACY** |
| [UI_COMPONENT_SYSTEM.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_COMPONENT_SYSTEM.md) | Legacy CSS tokens and component definitions. | **LEGACY** |
| [UI_CONSTITUTION.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_CONSTITUTION.md) | Legacy UX principles. | **LEGACY** |
| [UI_RUNTIME_FLOW.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_RUNTIME_FLOW.md) | Legacy UI interaction cycles. | **LEGACY** |
| [UI_SECURITY_MODEL.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_SECURITY_MODEL.md) | Legacy frontend security assumptions. | **LEGACY** |
| [UI_BUILD_PROMPT.md](file:///c:/Pro/PROJECT/ProofPost/docs/ui/UI_BUILD_PROMPT.md) | Original dashboard build prompt. | **LEGACY** |

---

## 🤖 Agent Rules & Workflows (`.agents/`)

### Master Rules (`.agents/rules/`)
| File | Description | Status |
| :--- | :--- | :--- |
| [autopost-rules.md](file:///c:/Pro/PROJECT/ProofPost/.agents/rules/autopost-rules.md) | **Always-On Master Rules**. | **ACTIVE** |

### Complete Workflow List (`.agents/workflows/`)
| Command / Workflow | Purpose | Status |
| :--- | :--- | :--- |
| `/ui-review` | [ui-review.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/ui-review.md) — Frontend architecture audit. | **ACTIVE** |
| `/PHASE1_OPERATIONAL` | [PHASE1_OPERATIONAL.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/PHASE1_OPERATIONAL.md) — Guide to MVP. | **ACTIVE** |
| `/FINAL_SYSTEM_REVIEW` | [FINAL_SYSTEM_REVIEW.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/FINAL_SYSTEM_REVIEW.md) — Pre-release audit. | **ACTIVE** |
| `/full-system-review` | [full-system-review.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/full-system-review.md) — Deep dive. | **ACTIVE** |
| `/SETTINGS_FIX_PROMPT` | [SETTINGS_FIX_PROMPT.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/SETTINGS_FIX_PROMPT.md) — Canonical settings fix. | **ACTIVE** |
| `/build-module` | [build-module.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/build-module.md) — Backend module standards. | **ACTIVE** |
| `/build-component` | [build-component.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/build-component.md) — UI component standards. | **ACTIVE** |
| `/add-platform` | [add-platform.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/add-platform.md) | New platform adapter guide. | **ACTIVE** |
| `/fix-bug` | [fix-bug.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/fix-bug.md) — Regression resolution. | **ACTIVE** |
| `/security-review` | [security-review.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/security-review.md) — Trust audit. | **ACTIVE** |
| `/architecture-review` | [architecture-review.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/architecture-review.md) — Structural check. | **ACTIVE** |
| `/review-session` | [review-session.md](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/review-session.md) — Session checklist. | **ACTIVE** |
| `/runtime-debug` | [runtime-debug](file:///c:/Pro/PROJECT/ProofPost/.agents/workflows/runtime-debug) — Runtime assistant. | **ACTIVE** |

---

## ⚠️ Known Documentation Gaps
*The following files are referenced in workflows but are currently missing from the `docs/` directory:*
- `docs/OPERATOR_DEBUG_MODE.md` (PLANNED)
- `docs/CANONICAL_STRUCTURE.md` (PLANNED)

---

## 💡 How to use this Map
1. **New Task?** Read `autopost-rules.md` first.
2. **Touching Backend?** Read `docs/governance/constitution.md` and `docs/governance/system.md`.
3. **Touching Frontend?** Read `docs/v1.1/UI_ENGINEERING_RULES.md` and `docs/v1.1/UI_SPEC.md`.
4. **Architecture Audit?** Invoke `/full-system-review` or `/ui-review`.

*This map is a living document. Update it whenever new documentation or workflows are added.*
