# Changelog

All notable changes to `agent-squad` will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).

## [Unreleased]

## [0.1.1] — wire tool hooks into Claude Code; ship session docs

### Fixed
- `hooks/hooks.json` added so Claude Code's plugin runtime actually
  registers `branch-guard` (on `PreToolUse:Write|Edit`) and `rebase-guard`
  (on `PreToolUse:Bash`). In v0.1.0 the hook scripts shipped but had no
  runtime registration — they only fired because `ai-dlc-board-manager`
  v0.3 redundantly wired the same scripts. Without this file, the
  board-manager v0.4 migration (which removes that redundant wiring)
  would have silently disabled enforcement. No contract change.

### Added
- `CLAUDE.md` — project guidance auto-loaded by Claude Code / Cowork
  sessions working in this repo.
- `SESSION_HANDOFF.md` — record of the bootstrap session, retained as
  historical context for early-life contributors.

## [0.1.0] — initial release

### Added — contract
- Three-persona model: `lead`, `architect`, `implementer`.
- Role composition schema (`contract/role-schema.md`) — projects declare
  `persona + skills + lanes` per role in their own `AGENTS.md`.
- Contract-first rule promoted from project convention to construct guarantee.
- Self-review format with per-persona templates (`contract/self-review-format.md`).
- Lifecycle hooks contract: `pre-implement`, `post-implement`, `pre-pr`, `post-pr`
  (`contract/lifecycle-hooks.md`).
- Tool hooks contract (host-specific, Claude Code): `branch-guard`, `rebase-guard`,
  and the `.agent-squad/session.yml` active-role marker schema
  (`contract/tool-hooks.md`).
- Plan-mode policy: each persona declares `default_mode` and
  `plan_mode_triggers` in its frontmatter. Architect defaults to plan; Lead
  and Implementer default to execute with explicit trigger lists.
- Governance rules (`contract/governance.md`).
- Workflow: Lead → Architect → Implementer staging guarantee
  (`contract/workflow.md`).

### Added — implementation
- `hooks/branch-guard.js` — protected-branch + lane-discipline enforcement
  (reads `.agent-squad/session.yml`). Honours `enabled`/`warn`/`disabled` modes.
- `hooks/rebase-guard.js` — auto-rebase onto the default branch before each
  commit. Dynamic default-branch detection. Honours mode config.
- `skills/core/implement/hooks/check-brief-and-contract.js` (pre-implement) —
  validates brief, verifies contract presence in default branch, resolves role
  from `AGENTS.md`, writes the session marker.
- `skills/core/finish-feature/hooks/validate-self-review.js` (pre-pr) —
  enforces per-persona self-review block, including placeholder detection and
  `git diff` cross-check on `### Files changed`.
- `skills/core/finish-feature/hooks/move-to-pr-review.js` (post-pr) —
  archives the session marker, emits `NEXT_STEP move_issue_status` when the
  board-manager integration is configured.
- `bin/validate-frontmatter.js` — CLI validator for personas + skills,
  enforces required fields and contract values.
- `bin/validate-role-schema.js` — CLI validator for project `AGENTS.md` role
  block.
- Example `AGENTS.md` and `.ai-dlc.yml` for projects.
- `tests/run.sh` — 31 smoke tests across all hooks and validators.
- `tests/ci-dry-run.sh` — local equivalent of `plugin-ci.yml` for pre-push
  verification.
- `package.json` with `npm test`, `npm run ci`, and validator scripts.
- `.github/workflows/plugin-ci.yml` — full CI: manifest + frontmatter + role
  schema + hook syntax + smoke tests. Fails on any error.

### Notes
- This is the v0.1 release — contract may shift in 0.x. Locks at v1.0.
- Migration path for `ai-dlc-board-manager` collapsed from three-phase to
  two-phase: agent-squad ships standalone-complete; board-manager v0.4 will
  drop its duplicate hooks and hard-dep on `agent-squad >= 0.1`.
- First domain skill (`aws`) ships separately, paired with the Architect
  persona, to validate the contract against a real consumer with non-code
  outputs.
