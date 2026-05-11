# Changelog

All notable changes to `agent-squad` will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).

## [Unreleased]

## [0.1.0] — initial release

### Added
- Three-persona model: `lead`, `architect`, `implementer`.
- Role composition schema (`contract/role-schema.md`) — projects declare
  `persona + skills + lanes` per role in their own `AGENTS.md`.
- Contract-first rule promoted from project convention to construct guarantee.
- Self-review format with per-persona templates.
- Lifecycle hooks: `pre-implement`, `post-implement`, `pre-pr`, `post-pr`.
- Plan-mode policy: each persona declares `default_mode` and
  `plan_mode_triggers` in its frontmatter; hosts SHOULD auto-engage plan mode
  on entry and on declared triggers (e.g. missing brief, missing contract,
  lane crossing). Architect defaults to plan; Lead and Implementer default to
  execute with explicit trigger lists.
- Governance rules (lifted and generalised from dicom-store-v2 `AGENTS.md`).
- Hooks: `branch-guard`, `rebase-guard` (ported from `ai-dlc-board-manager`).
- Core skills: `implement`, `finish-feature` (ported, persona-aware).
- Example `AGENTS.md` and `.ai-dlc.yml` for projects.
- CI workflow validating manifest JSON and skill/persona frontmatter.

### Notes
- This is the v0.1 release — contract may shift in 0.x. Locks at v1.0.
- Migration path for `ai-dlc-board-manager`:
  - v0.4 of board-manager: copies these artefacts with deprecation warnings.
  - v0.5: board-manager hard-deps on `agent-squad >= 0.1`.
  - v1.0 of construct: contract locked.
- First domain skill (`aws`) ships separately, paired with the Architect persona,
  to validate the contract against a real consumer with non-code outputs.
