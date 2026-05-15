# ProofPost — Changelog

All notable changes to this project will be documented in this file.

---

## [2026-05-14] - V1.1 Governance Freeze & Stabilization

### Added
- Created `docs/V1_COMPLETION_PLAN.md` to define "Done" criteria.
- Created `docs/OPERATOR_TESTING_GUIDE.md` for manual verification.
- Standardized Canonical API Error Object across all specs.
- Mandated Draft Rehydration via `localStorage` in `UI_STATE_SCHEMA.md`.
- Added Approval In-Flight guards to `WORKSPACE_STATE_MACHINE.md`.
- Mandated Property Setters for complex component data in `UI_COMPONENT_CATALOG.md`.
- Created `docs/v1.1/prompt.md` containing phase-by-phase implementation recipes.

### Changed
- **CRITICAL**: Banned Shadow DOM in `UI_ENGINEERING_RULES.md` to protect `tokens.css` inheritance.
- Standardized all repository documentation paths to `docs/v1.1/`.
- Updated `SYSTEM_INVENTORY.md` to reflect the final V1.1 doctrine.
- Integrated frontend workflow redirection in `build-module.md`.
- Created `docs/v1.1/UI_STATE_SCHEMA.md` to define authoritative frontend state.
- Created `docs/v1.1/UI_API_INTEGRATION.md` to lock frontend ↔ backend contracts.
- Created `docs/v1.1/WORKSPACE_SPEC.md` to define core workspace behavior.
- Created `docs/v1.1/UI_COMPONENT_CATALOG.md` to standardize Web Components.
- Created `docs/v1.1/VIEW_LIFECYCLE.md` to prevent memory/polling leaks.
- Created `docs/v1.1/WORKSPACE_STATE_MACHINE.md` to define fact lifecycles.
- Created `docs/v1.1/PLATFORM_RENDERING_SPEC.md` to define platform-specific formatting.
- Created `docs/v1.1/ROUTING_SPEC.md` to define routing rules and guards.
- Created `.agents/workflows/ui-review.md` for frontend architecture audits.
- Created `docs/SYSTEM_INVENTORY.md` (and updated it) to map all documentation.

### Changed
- Updated `.agents/rules/autopost-rules.md` with View-from-Store rendering rule.
- Updated `docs/v1.1/UI_ENGINEERING_RULES.md` with lifecycle cleanup requirements.
- Updated `.agents/workflows/build-module.md` to reference new frontend workflows.
- Standardized all documentation paths to `docs/v1.1/`.

### Fixed
- Outdated inventory references to missing documentation.
- Path inconsistency between `docs/ui/` and `docs/v1.1/`.
