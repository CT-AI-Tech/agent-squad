# CONTRACT.md — agent-squad public contract surface

**Version: 0.1.0**

This file defines the **public** contract of `agent-squad`. Everything listed
here is bound by [semver](https://semver.org). Breaking changes only on a major
bump. Anything not listed here is internal and may move without notice.

---

## 1. Persona files

Files in `personas/` MUST have the frontmatter schema defined in
[`contract/persona-schema.md`](contract/persona-schema.md).

The set of persona names is fixed at v0.x: `lead`, `architect`, `implementer`.
Adding a persona is a major bump. Removing one is a major bump. Behaviour
extensions to an existing persona are minor bumps.

## 2. Skill files

Files in `skills/**/SKILL.md` MUST have the frontmatter schema defined in
[`contract/skill-schema.md`](contract/skill-schema.md). Skills MUST declare:
- `construct_version` — the minimum agent-squad version required.
- `persona_affinity` — which persona(s) this skill decorates.

## 3. Role mapping schema

The project-level `AGENTS.md` MUST conform to the YAML grammar in
[`contract/role-schema.md`](contract/role-schema.md). Each role MUST resolve to
exactly one persona, zero or more skills, and a lane block with `write` and
optional `read` globs.

## 4. Self-review format

PRs opened via `finish-feature` MUST include the self-review block defined per
persona in [`contract/self-review-format.md`](contract/self-review-format.md).
Section names are part of the contract.

## 5. Lifecycle hooks

Skills and hooks MAY register handlers for the named lifecycle events in
[`contract/lifecycle-hooks.md`](contract/lifecycle-hooks.md). Event names and
context payload shape are part of the contract.

## 5a. Tool hooks (host-specific)

The two named tool hooks (`branch-guard`, `rebase-guard`) and the
`.agent-squad/session.yml` marker file format defined in
[`contract/tool-hooks.md`](contract/tool-hooks.md) are part of the contract.
Tool hooks fire on host tool calls (e.g. Claude Code `PreToolUse`) rather than
at workflow-stage transitions, and are host-specific by design.

## 6. Hooks config schema

The `.ai-dlc.yml` `hooks:` block schema is defined in
[`contract/lifecycle-hooks.md#hooks-config-schema`](contract/lifecycle-hooks.md).
Each hook accepts `enabled` | `warn` | `disabled`.

## 7. Governance rules

The non-negotiable rules in [`contract/governance.md`](contract/governance.md)
apply to every persona and every skill. Removing a rule is a major bump.
Adding a rule is a minor bump if it can be satisfied by existing skills, otherwise
a major bump.

## 8. Workflow

The Lead → Architect → Implementer handoff sequence in
[`contract/workflow.md`](contract/workflow.md) is part of the contract. Skills
MAY refine the flow but MUST NOT skip stages.

## 9. Orchestration

The single-session dispatch protocol in
[`contract/orchestration.md`](contract/orchestration.md) is part of the
contract: the dispatch loop, the task status vocabulary, the four rendering
blocks (Ticket Intake, Squad Board, Handoff, Return) and their required
fields, the wave-construction rules, and the branch/PR policy (fully
sequential plan = one branch + one PR; any parallel wave = worktree + branch +
PR per task). Renaming a block or a status, or changing the branch/PR policy,
is a major bump. Adding optional fields to a block is a minor bump.

---

## What is *not* contract

- Persona prose content (the descriptive sections of each persona file).
- Skill knowledge content (everything below the frontmatter in a `SKILL.md`).
- Internal helper scripts under `bin/`.
- Plugin manifest internals beyond name + version.
- The README, QUICKSTART, and CHANGELOG.

## Compatibility table

| agent-squad version | board-manager version | breaking? |
|---|---|---|
| 0.1.x | 0.4.x (copy + deprecate) | no |
| 0.1.x | 0.5.x (hard dep) | no |
| 1.0.0 | 0.6.x (lock) | locks contract |
