# Changelog

All notable changes to `agent-squad` will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).

## [Unreleased]

### Added
- `examples/roles/` — starter library of single-role fragment templates,
  one per file: `lead`, `cloud-architect`, `backend-dev`, `frontend-dev`,
  `devops-engineer`. Each `*.role.md` is a copy-paste-ready yaml entry
  for a project's `AGENTS.md` `roles:` list, plus prose covering when
  to use the role, common variations, and skills implied. Fragments are
  not standalone `AGENTS.md` files (the validator requires a `lead`
  role, so a single non-lead fragment can't validate alone); smoke tests
  wrap each fragment with a stub lead before validating.
- `examples/roles/README.md` — index of the templates, usage
  instructions, and rules for adding new templates.
- `skills/domain/{aws,python,fastapi,postgres,react,typescript,docker,terraform,github-actions}/SKILL.md`
  — nine domain-skill stubs covering every skill the new role templates
  reference. Each is a minimal but contract-valid `SKILL.md`
  (frontmatter + short body). Real content for these skills is deferred
  to v0.3 per `SESSION_HANDOFF.md`. `aws` uses `persona_affinity: [both]`
  with the required `## Architect mode` and `## Implementer mode` body
  sections per `CLAUDE.md`.
- `tests/run.sh` — new `role templates` section that synthesises a
  composed `AGENTS.md` for each fragment and validates via the existing
  `validate-role-schema.js`. Domain-stub frontmatter validation folded
  into the existing `validate-frontmatter` section. Suite total now 38
  passing (up from 32).

### Changed
- `examples/AGENTS.md.example` — added a "See also" pointer to
  `examples/roles/` so adopters who only need a couple of roles can
  start from the smaller fragments instead of copying the full project
  example.

### Fixed
- `hooks/branch-guard.js` now bails with exit `0` when the `file_path`
  argument resolves outside the repo root, *before* the protected-branch
  check. Previously, writes to any path on a protected branch were
  blocked — including paths outside the working tree (e.g. plan files
  under `~/.claude/plans/`). The protected-branch rule is meant to keep
  implementation work off `main`, not to gate every Write tool call the
  agent makes. The lane-discipline check that follows was already
  file-path-scoped and is unchanged. Smoke test added in
  `tests/run.sh` (`branch-guard: allows outside-repo path on main`).
- `tests/run.sh` updated to reference the flattened skill paths
  (`skills/<name>/...`) introduced in commit `14a58ad`. The flatten
  migration left 15 stale `skills/core/<name>/...` references in the
  test harness; this brought the test count back to green
  (32/32 pass, up from 19/32).

## [0.1.1] — wire tool hooks; fix plugin + marketplace manifests; ship session docs

### Fixed
- `hooks/hooks.json` added so Claude Code's plugin runtime actually
  registers `branch-guard` (on `PreToolUse:Write|Edit`) and `rebase-guard`
  (on `PreToolUse:Bash`). In v0.1.0 the hook scripts shipped but had no
  runtime registration — they only fired because `ai-dlc-board-manager`
  v0.3 redundantly wired the same scripts. Without this file, the
  board-manager v0.4 migration (which removes that redundant wiring)
  would have silently disabled enforcement. No contract change.
- `.claude-plugin/marketplace.json` rewritten to match the Claude Code
  marketplace catalog schema (`owner`, `plugins[]`). The v0.1.0 file was
  in a single-plugin-description shape (`version`, `category`, `tags`,
  `compatibility`, ...) that Claude Code's plugin loader rejects with
  "owner: Invalid input: expected object, plugins: Invalid input:
  expected array". No contract change.
- `.claude-plugin/plugin.json` pruned to the fields Claude Code's
  loader accepts. Removed empty-string `homepage`/`repository` (failed
  URL validation), removed the path-list `hooks` and `skills` arrays
  (loader rejects them as "Invalid input" — hooks are wired via
  `hooks/hooks.json`, skills auto-discovered from `skills/**/SKILL.md`),
  and dropped the custom `construct` / `personas` blocks that no
  consumer reads. Same minimal shape as `ai-dlc-board-manager`'s
  working manifest.

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
