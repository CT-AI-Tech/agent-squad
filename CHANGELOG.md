# Changelog

All notable changes to `agent-squad` will be documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning is strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).

## [Unreleased]

## [0.8.1] — dispatch carries the estimate onto the marker (token note fix)

Field-trial regression. Once work moved to single-session `orchestrate`
dispatch, the Lead and its spawned agents write the session marker via
`squad-session set` instead of going through `/agent-squad:implement`. Only the
`implement` skill's `pre-implement` hook (`check-brief-and-contract`) ever
copied the brief's `estimate` onto the marker, so in dispatch mode
`marker.estimate` was always absent. `move-to-pr-review` then emitted
`USAGE_TOTAL` with no `estimate=`, and `finish-feature`'s `### Token usage`
note lost the estimate half — the "token estimation vanished" symptom. (The
actuals kept recording; the ledger keys off `marker.issue`, which
`squad-session` does set.)

### Added (contract — minor bump)
- `bin/squad-session.js` — `set` accepts `--estimate S|M|L|XL` (case-insensitive
  input, stored uppercase; invalid values exit `1`), putting the brief's size
  class on the marker in dispatch mode. When the flag is omitted, `set`
  preserves any estimate already on the marker, so sequential dispatch
  switching roles per task does not drop it.
- `contract/tool-hooks.md` — `--estimate` documented in the CLI semantics and
  the `estimate` marker-field note; `contract/orchestration.md` and
  `contract/brief-format.md` state that dispatch carries the estimate via the
  CLI rather than the `pre-implement` hook.

### Changed
- `skills/orchestrate/SKILL.md` (0.2.1) — the subagent marker-set command now
  passes `--estimate <brief-estimate>`, with a note that it comes from the
  task brief frontmatter and is omitted when the brief has none.

### Tests
- `tests/run.js` — estimate coverage in both the js-yaml and fallback
  squad-session sections: `--estimate` records and normalizes the value,
  `get estimate` reads it back, a role switch without the flag preserves it,
  and an invalid value exits `1`.

## [0.8.0] — squad-session works without js-yaml; `get` subcommand

Third field-trial fix. In the fhir-query-validator-factory trial the shipped
`squad-session.js` (copied into the consumer project under `scripts/hooks/`)
exited with "js-yaml is required" because the consumer had never run
`npm install`. The `.agent-squad/session.yml` marker could not be flipped
from `role: lead`, so `branch-guard` blocked the integration-tester's writes
to `tests/integration/` and stranded the orchestration wave. Per the coding
standard, hook-adjacent scripts must degrade gracefully when dependencies are
absent — hand-parse simple YAML where possible.

### Added (contract — minor bump)
- `bin/squad-session.js` — `get [<field>]` subcommand: prints the active
  marker as JSON (or a single field's value; lists print one item per line),
  exits `1` when no marker is active.
- `contract/tool-hooks.md` — the `squad-session` CLI is now contractually
  required to work without `js-yaml` installed, and its semantics include
  `get`.

### Fixed
- `bin/squad-session.js` — `js-yaml` is now optional. When it cannot be
  resolved (consumer project without `npm install`), the CLI falls back to a
  built-in hand-rolled YAML emitter/parser covering the flat session.yml
  schema (`construct_version`, `role`, `persona`, `skills`, `write_lanes`,
  `read_lanes`, `issue`, `model`), persona frontmatter scalars, and the
  conventional AGENTS.md role-schema layout (flow and block lists, flow maps,
  nested lanes). Markers written by the fallback are byte-compatible with the
  hand parser `branch-guard` already uses. `AGENT_SQUAD_NO_JS_YAML=1` forces
  the fallback (used by the smoke tests).

### Tests
- `tests/run.js` — new "squad-session js-yaml fallback" section (10 checks):
  set/get/clear without js-yaml, flow- and block-style AGENTS.md parsing,
  persona default-model resolution, and branch-guard lane enforcement driven
  by a fallback-written marker (the exact stranded-wave scenario).

## [0.7.0] — synchronous dispatch, lost-agent recovery, board mirroring

Second field-trial fix. In the fhir-query-validator-factory trial the Lead
gated round 1 correctly, then re-dispatched the fix round by messaging the
already-finished agent. The host resumed that agent detached in the
background, it terminated without a completion record, and the orchestrator
sat waiting on a result that could never arrive. The same run also left the
GitHub board stale (ticket never moved to Agent Work) and gave the user no
status surface while waiting.

### Added (contract — minor bump)
- `contract/orchestration.md` — "Lost agents and recovery" section: dispatch
  is synchronous from the orchestrator's point of view; an agent that ends
  without a Return is `halted`; Lead MUST inspect the working tree, salvage
  committed work (rendering the Return block on the agent's behalf), and
  re-dispatch the remainder fresh — never wait indefinitely. Turns that end
  with a task `in-progress` MUST end with the Squad Board plus a
  "waiting on" line.
- `contract/orchestration.md` — gate: `CHANGES REQUESTED` now returns the
  task to the same **role** via a fresh dispatch (feedback appended to the
  brief, new Handoff block). Resuming/messaging a completed agent is
  explicitly prohibited.
- Host mapping — Agent tool calls are `run_in_background: false`; a parallel
  wave is multiple synchronous calls in one message; board status mirroring
  belongs to the PM plugin (ai-dlc-board-manager), which orchestrate invokes
  when `.ai-dlc.yml` wires a board.

### Changed
- `skills/orchestrate/SKILL.md` (0.2.0) — implements all of the above:
  synchronous spawns only, fresh-agent fix rounds ("round 2" handoffs),
  a "Recover lost agents" runbook step, board mirroring before the first
  handoff, and a visibility rule that no turn ends silently while a task is
  in progress.

## [0.6.1] — Lead adopts its alias at session start

First field-trial fix. In 0.6.0 the orchestrate skill read the ticket before
`AGENTS.md`, so the Lead's opening narration ("I'll act as the Lead...")
happened before it knew its alias, and the alias instruction was too weak to
change its voice afterwards.

### Fixed
- `skills/orchestrate/SKILL.md` (0.1.1) — reading `AGENTS.md` is now the
  first intake action; the Lead adopts the lead role's alias immediately,
  introduces itself by name, and never self-refers as "the Lead" when an
  alias is defined. Visibility rule extended to the Lead's own voice.
- `contract/orchestration.md` — visibility contract now states explicitly
  that the alias rule includes the Lead itself (clarification, not a block
  or policy change).

## [0.6.0] — single-session squad dispatch (orchestrate)

The Lead persona can now run the whole workflow in one session, visibly
handing each task to a named squad agent — sequential plans on one branch/PR,
parallel waves in per-task git worktrees. Contract changes are additive
(minor bump).

### Added
- `contract/orchestration.md` — single-session squad dispatch protocol
  (contract surface, referenced as CONTRACT.md section 9). The Lead persona
  runs the whole Lead -> Architect -> Implementer -> review workflow in one
  session, handing each task to a spawned agent like a tech lead assigning
  tickets. Defines: the dispatch loop, the task status vocabulary, four
  mandatory rendering blocks (Ticket Intake, Squad Board, Handoff, Return) so
  every assignment is visible in the transcript, wave-construction rules
  (disjoint lanes + no dependency edge + contract in main => parallel), and
  the branch/PR policy — fully sequential plan = one branch + one PR; any
  parallel wave = git worktree + branch + PR per task, merged by Lead in
  dependency order.
- `skills/orchestrate/SKILL.md` (0.1.0, `persona_affinity: [lead]`) — the
  Lead's dispatch runbook implementing the protocol on Claude Code:
  `/agent-squad:orchestrate <issue>` decomposes the ticket, spawns one
  subagent per task (Agent tool, labelled `<alias> (<role>): <task>`),
  switches the session marker per task in sequential mode, creates
  `.worktrees/<issue>-<task-slug>` per task in parallel mode, and gates every
  return before merge.
- `contract/workflow.md` — new "Orchestrated execution (single session)"
  section: orchestration changes where the stages run, never the stage order
  or the hard rules.
- `personas/lead.md` bumped to 0.3.0 — dispatcher behaviour added
  (orchestrated dispatch section, spawned-agent rows in the hand-off
  contract, new invoked_when/outputs entries).

## [0.5.0] — reviewable agent PRs (bot identity)

Enables the human operator to formally review agent PRs. GitHub blocks
approve / request-changes / inline suggestions on PRs opened by your own
account; this release lets `finish-feature` open PRs under a dedicated bot
identity instead.

### Added
- `AGENT_SQUAD_GH_TOKEN` environment variable (contract surface, defined in
  `contract/workflow.md#pr-author-identity`). When set, `finish-feature`
  passes it as `GH_TOKEN` to the `gh pr create` invocation only — commits
  and pushes keep the session's normal credentials — so the PR is authored
  by the bot/machine account behind the token and the human operator can
  approve, request changes, and leave inline suggestions. When unset,
  behaviour is unchanged (PR opened with the session's own `gh` auth).
  One bot identity serves the whole squad; per-persona attribution stays in
  commit metadata. `skills/finish-feature/SKILL.md` bumped to 0.2.0.
- QUICKSTART step 3a — how to create the bot machine account, issue a
  fine-grained PAT (Pull requests: read/write, repo-scoped), and where to
  store it (user environment variable or `.claude/settings.local.json`
  `env` block; never committed). README gains a "Reviewing agent PRs as a
  human" section. Troubleshooting entry added for the locked-review symptom.

### Fixed
- `hooks/branch-guard.js` — writes under `.agent-squad/` are now exempt from
  both the protected-branch rule and lane discipline. The pre-pr contract
  directs the implementer to stage the PR body at `.agent-squad/pr-body.md`,
  but the guard blocked that write because `.agent-squad/` is never in a
  role's lanes, forcing agents to detour through a temp directory every
  finish-feature run. The construct's own working state (session marker,
  `pr-body.md`, usage ledger) is never implementation work. Documented in
  `contract/tool-hooks.md`; covered by 2 new smoke tests.

### Changed
- `skills/implement/SKILL.md`, `skills/finish-feature/SKILL.md` — invocation
  examples now use the plugin-namespaced command form
  (`/agent-squad:implement`, `/agent-squad:finish-feature`) to match how the
  skills are exposed when installed as a plugin, consistent with
  `/agent-squad:init` and QUICKSTART.

## [0.4.0] — feature economics + cross-platform tests

Second field-feedback release: reviewer test handoff, Lead size estimates,
actual token tracking per feature, and a Windows-first cross-platform test
harness. Contract changes are additive except the flagged self-review
tightening.

### Added
- `contract/brief-format.md` — formalizes the Agent Brief schema the
  pre-implement hook has enforced de facto since v0.1 (search order,
  frontmatter fields, required `## Testable Check` body section), plus the
  new optional `estimate: S|M|L|XL` frontmatter field with token
  calibration bands (explicitly bands for comparison against recorded
  actuals, not promises). `check-brief-and-contract` rejects invalid
  values and copies valid ones into the session marker (new optional
  `estimate` field, schema in `contract/tool-hooks.md`).
  `examples/brief.md.example` added.
- `hooks/usage-tracker.js` — new `usage-tracker` tool hook (Stop, Claude
  Code specific). On every Stop with an active marker carrying an issue,
  recomputes the session's token totals from the transcript and overwrites
  its entry in the per-issue ledger `.agent-squad/usage.json`
  (idempotent — repeated Stops never double-count; multiple sessions
  accumulate per issue). Ledger schema is contract
  (`contract/tool-hooks.md`); mode key `usage_tracker` in `.ai-dlc.yml`.
- `USAGE_TOTAL` stdout line from `move-to-pr-review` (post-pr): feature
  token totals summed across sessions, paired with the brief's `estimate`
  read from the marker before archival. `finish-feature` documents an
  optional `### Token usage` PR-body note (estimate vs actual) — not
  validator-required since the ledger is host-specific.
- `tests/lib/harness.js`, `tests/run.js`, `tests/ci-dry-run.js` — the
  smoke-test suite and CI dry-run ported to cross-platform Node (no shell
  dependency; runs identically from PowerShell, bash, or cmd).
  `tests/run.ps1` / `tests/ci-dry-run.ps1` PowerShell wrappers added;
  `tests/run.sh` / `tests/ci-dry-run.sh` rewritten as thin wrappers around
  the Node scripts. Suite total now 66 passing (up from 55), including new
  coverage for estimates, the usage ledger, and the How-to-test section.

### Changed
- **`### How to test` is now a required section in the implementer
  self-review** (`contract/self-review-format.md`,
  `validate-self-review.js`): reviewer-facing reproduction steps, at least
  2 steps or 1 command line. This is a contract tightening tolerated under
  the 0.x semver policy — adopters must update PR templates.
- `skills/finish-feature/SKILL.md` — required-section list updated to the
  actual v0.x section names (it still described the retired v0.1
  field-style block) and now includes `### How to test`.
- `personas/lead.md` briefing guidance and `contract/workflow.md` — Lead
  SHOULD set `estimate:` in the brief and calibrate against `USAGE_TOTAL`
  actuals.
- Canonical verification command is now `node tests/ci-dry-run.js`
  (`CLAUDE.md`, `QUICKSTART.md`); `plugin-ci.yml` smoke step switched to
  `node tests/run.js`; `package.json` scripts updated and version aligned
  to the plugin version. QUICKSTART states the runtime layer is plain Node
  with no per-OS setup.

### Fixed
- `.gitignore` now also ignores `.agent-squad/session.*.yml` (archived
  markers escaped the existing `session.yml` ignore) and the new
  `.agent-squad/usage.json`.

## [0.3.0] — persona visibility, model hints, init skill

Field feedback release (from first real adoption, fhir-validator): make the
active agent visible, let roles hint their model tier, and automate adoption.
All contract changes are additive (minor bump).

### Added
- `hooks/session-context.js` — new `session-context` tool hook
  (UserPromptSubmit, SessionStart). Injects a one-line description of the
  active role (persona, role, issue, model hint) into the model's context so
  the agent always knows and announces which persona it is operating as.
  Informational only, never blocks. Mode key `session_context` in
  `.ai-dlc.yml`. Registered in `hooks/hooks.json`; documented as contract in
  `contract/tool-hooks.md`.
- `bin/squad-status.js` — statusline helper rendering the active role
  (`[agent-squad] implementer:backend-dev #42 (sonnet)`) from the session
  marker; silent when no marker exists. Wiring snippet in QUICKSTART; the
  init skill offers to wire it into project `.claude/settings.json`.
- `bin/squad-session.js` — session marker CLI (`set <role> [--issue N]` /
  `clear`) so Lead and Architect flows can hold the active-role marker too.
  Previously only the implementer flow (pre-implement hook) ever wrote it.
  Marker-write semantics documented as contract in `contract/tool-hooks.md`;
  lead/architect persona bodies now instruct when to set/clear.
- `hooks/lib/session-marker.js` — shared dependency-free marker/config
  parser extracted from `branch-guard.js`, consumed by `branch-guard`,
  `session-context`, and `squad-status`.
- Optional `model` field (`opus | sonnet | haiku | inherit`): persona
  frontmatter default (`contract/persona-schema.md`) with per-role override
  in the role schema (`contract/role-schema.md`); precedence role > persona
  > unset. Resolved into the session marker (`model` field, schema in
  `contract/tool-hooks.md`) by the pre-implement hook and `squad-session`,
  surfaced by `session-context` and the statusline. Advisory in-session
  (the context line suggests `/model <hint>` on mismatch); binding where the
  host supports per-agent models. Persona defaults: lead/architect `opus`,
  implementer `sonnet`. Both validators enforce the enum.
- `skills/init/SKILL.md` — new core skill `/agent-squad:init`
  (persona_affinity: lead). Scans a consumer project's plan docs and tech
  manifests, composes a draft `AGENTS.md` from `examples/roles/` fragments,
  validate-loops it with `bin/validate-role-schema.js`, scaffolds
  `.ai-dlc.yml` from `skills/init/templates/ai-dlc.yml`, and offers
  statusline wiring. Never overwrites an existing `AGENTS.md`, never creates
  plan docs (board-manager's `spec-to-plan` owns that).
- `tests/run.sh` — four new sections (model hint validation, squad-session /
  squad-status / session-context, check-brief model resolution, init skill
  artifacts). Suite total now 55 passing (up from 38).

### Changed
- `personas/*.md` bumped to 0.2.0: `model` frontmatter defaults added;
  lead/architect gained "Session marker" and "Model hint" body sections.
- `skills/implement/SKILL.md`, `skills/finish-feature/SKILL.md` — instruct
  the agent to state its active persona and role at turn start
  (belt-and-braces with the `session-context` hook).
- `hooks/branch-guard.js` — internal refactor to the shared marker lib; no
  behaviour change (existing smoke tests unchanged and green).
- `QUICKSTART.md` — `/agent-squad:init` is now the recommended adoption
  path; new "See who is active" section covering context injection and the
  statusline.
- `examples/roles/README.md` — the "Scripted" section referenced a
  `bin/scaffold-role.js` that was never shipped; repointed to the init
  skill. Fragment format documented as load-bearing (init consumes it).
- `examples/AGENTS.md.example`, `examples/roles/backend-dev.role.md`,
  `examples/.ai-dlc.yml.example` — commented `model:` examples and the
  `session_context` mode key.

### Fixed
- `tests/ci-dry-run.sh` and `.github/workflows/plugin-ci.yml` still globbed
  `skills/core/*` (dead since the flatten in `14a58ad`), so `implement` and
  `finish-feature` hook syntax and SKILL.md frontmatter were silently
  skipped in CI. Globs updated to `skills/*/...`; stage 3 now also
  syntax-checks `hooks/lib/*.js` and `bin/*.js`.

### Added (pre-0.3.0 unreleased work, shipped here)
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

### Changed (pre-0.3.0 unreleased work, shipped here)
- `examples/AGENTS.md.example` — added a "See also" pointer to
  `examples/roles/` so adopters who only need a couple of roles can
  start from the smaller fragments instead of copying the full project
  example.

### Fixed (pre-0.3.0 unreleased work, shipped here)
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
