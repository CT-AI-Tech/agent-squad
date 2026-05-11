---
name: implement
version: 0.1.0
construct_version: ">=0.1.0"
description: The Implementer's coding loop. Reads brief, validates contract presence, writes code in lane, runs tests, prepares for finish-feature.
persona_affinity: [implementer]
domain: core
owner: agent-squad-core
hooks:
  pre-implement: hooks/check-brief-and-contract.js
---

## Description

The `implement` skill is the entry point for the Implementer persona. It is a
construct-owned (`domain: core`) skill — every Implementer session begins by
invoking it.

This skill is **persona-aware**: it refuses to run if the current role's persona
isn't `implementer`, or if the role isn't defined in the project's `AGENTS.md`.

## When this skill applies

Auto-triggers when the user invokes `/implement <issue-number>` or when an
Implementer session opens an issue assigned to them in Agent Work status.

## Implementer mode

The skill walks the Implementer through the build phase:

### 1. Pre-flight (handled by `pre-implement` hook)

- Verify a feature branch exists (per `branch-guard`).
- Verify the role is registered in `AGENTS.md` and resolves to `implementer`.
- Read the Agent Brief from the issue body. Halt if empty or placeholder-only.
- If the brief references a contract path, verify the file exists in `main`.
  Halt if missing.

### 2. Read

Before any file edit, the skill ensures the Implementer has read:

- The Agent Brief (issue body)
- The contract file (if applicable)
- The project `AGENTS.md` and `.ai-dlc.yml`
- The persona file (`personas/implementer.md`)
- Any skill files declared for the role

### 3. Build

The Implementer writes code in the assigned `write` lane only. The
`branch-guard` hook enforces this on every commit. If the work genuinely
requires touching another lane, the Implementer halts and asks Lead to widen
the lane in `AGENTS.md`.

### 4. Test

Every feature ships tests for the testable check named in the brief. Test
files live in the role's lane (typically `tests/` or co-located).

### 5. Hand off

When the testable check is met, the Implementer invokes `finish-feature`. This
skill does not open the PR itself — `finish-feature` is the dedicated step.

## Lifecycle hooks

This skill registers `pre-implement: hooks/check-brief-and-contract.js`. The
handler script lives in this skill's directory and runs before the first edit.
It validates:

- Brief is non-empty and references the issue's testable check
- Contract file exists in `main` (if brief flags a contract surface)
- Role is implementer-typed in `AGENTS.md`

Exit code 0 = pass; 1 = block; 2 = warn.

## References

- [`personas/implementer.md`](../../../personas/implementer.md) — persona contract
- [`contract/workflow.md`](../../../contract/workflow.md) — full workflow
- [`contract/governance.md`](../../../contract/governance.md) — non-negotiable rules
- [`skills/core/finish-feature/SKILL.md`](../finish-feature/SKILL.md) — what comes next

## Implementation notes

The handler script `hooks/check-brief-and-contract.js` lives alongside this
SKILL.md and is invoked with the lifecycle context payload on stdin. It:

1. Locates the brief at `.agent-squad/brief.md`, `briefs/<issue>.md`, or
   `briefs/<issue>-*.md` (in that priority order).
2. Validates the brief's frontmatter and presence of a non-empty
   `## Testable Check` section.
3. If the brief's frontmatter declares a `contract:` path, verifies the file
   exists in the default branch via `git cat-file`.
4. Reads the project's `AGENTS.md`, resolves the role assigned in the
   payload, and writes the resolved snapshot to `.agent-squad/session.yml`
   for downstream hooks (`branch-guard`, `validate-self-review`,
   `move-to-pr-review`) to consume.
