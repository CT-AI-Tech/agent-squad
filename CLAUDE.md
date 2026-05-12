# CLAUDE.md — agent-squad project guidance

This file is the persistent context for any Claude Code (or Cowork) session
working in this repo. Read it before changing anything.

---

## What agent-squad is

An organisation-wide **agent construct**: the behaviour contract for AI
engineering agents. Defines three personas, the role-composition schema,
the self-review format, and the lifecycle/tool hooks that enforce them.

It does **not** know about specific project boards, languages, or domains.
Those layer on top:
- Project boards → `ai-dlc-board-manager` (sibling repo, will hard-dep on this).
- Domain knowledge → `skills/domain/*` (e.g. `aws`, `python`, `dicom`).
- Project-specific composition → each consumer project's own `AGENTS.md`.

## The three-layer model — do not violate

```
Persona (behaviour) + Skills (knowledge) + Lanes (file scope) = Role
```

Behaviour belongs in personas. Knowledge belongs in skills. File scope belongs
in the project's `AGENTS.md`. Mixing layers is the most common way to break
the construct — push back if asked to add domain knowledge to a persona or to
add behaviour rules to a skill.

## Contract surface

Everything in [`CONTRACT.md`](CONTRACT.md) is semver-bound. The detailed
schemas live in [`contract/`](contract/):
- `persona-schema.md` — persona frontmatter
- `skill-schema.md` — skill frontmatter
- `role-schema.md` — project AGENTS.md role block
- `self-review-format.md` — per-persona self-review block (validated by `validate-self-review`)
- `lifecycle-hooks.md` — `pre-implement`, `post-implement`, `pre-pr`, `post-pr` events + payload
- `tool-hooks.md` — host-specific tool hooks (Claude Code `PreToolUse:Write/Edit/Bash`) + the `.agent-squad/session.yml` marker schema
- `governance.md` — non-negotiable rules
- `workflow.md` — Lead → Architect → Implementer staging guarantee

**Adding to the contract is a minor bump. Removing or renaming is a major bump.**
For 0.x releases, breaking changes are tolerated but should be flagged. After
v1.0 the contract locks.

## Before any change

1. Read `CONTRACT.md` and the relevant `contract/*.md` files.
2. Run the local CI dry-run to confirm a green baseline:

   ```bash
   npm install            # first time only
   bash tests/ci-dry-run.sh
   ```

3. Make the change.
4. Re-run `bash tests/ci-dry-run.sh`. All 31 smoke tests + 7 CI stages must
   pass before you commit.
5. Update `CHANGELOG.md` under `[Unreleased]` (or in the active version
   section if cutting a release).

## Coding standards

- Hooks (`hooks/*.js` and `skills/core/*/hooks/*.js`) must work with **no
  external runtime dependencies beyond `js-yaml`**. Hand-parse simple YAML
  where possible; only require `js-yaml` for nested role-schema parsing in
  `check-brief-and-contract`. Hosts may run hooks in environments where
  `npm install` hasn't run — fall back gracefully.
- CLI validators in `bin/` may depend on `js-yaml` freely — they're dev/CI
  tools.
- All hook scripts read JSON payload from stdin, exit `0` (pass) / `1`
  (block, lifecycle) / `2` (block, tool-hook style for Claude Code).
- No emoji in source files. Plain ASCII or Markdown only. Em-dashes are fine
  in docs but **not** in code comments — the Windows file-mount has a
  truncation bug at non-ASCII chars when files are written by the Write tool.
  Use bash heredoc when authoring hook scripts to avoid this.
- Persona/skill frontmatter must validate via `bin/validate-frontmatter.js`.
- Project `AGENTS.md` examples must validate via `bin/validate-role-schema.js`.

## Adding a domain skill

A new domain skill (e.g. `python`, `aws`, `dicom`) goes in
`skills/domain/<name>/SKILL.md`. Required frontmatter:

```yaml
---
name: <kebab-case>
version: 0.1.0
construct_version: ">=0.1.0"
description: <one-line, used for auto-trigger matching>
persona_affinity: [implementer | architect | lead | both]
domain: <name>
owner: <team>
---
```

If `persona_affinity: [both]`, the body MUST contain both `## Architect mode`
and `## Implementer mode` sections.

Update `examples/AGENTS.md.example` if the skill is intended to ship as a
reference for projects.

## Migration to ai-dlc-board-manager

board-manager v0.3.0 currently ships its own copies of `implement`,
`finish-feature`, `branch-guard`, `rebase-guard`. The plan is for
board-manager v0.4 to:

1. Remove its `bin/branch-guard.js`, `bin/rebase-guard.js`, `skills/implement/`,
   `skills/finish-feature/`.
2. Declare a hard dependency on `agent-squad >= 0.1.0` in its plugin manifest.
3. Keep its PM skills (`start-feature`, `board-sync`, `sprint-plan`) — those
   stay PM-side, agent-squad doesn't know about boards.

Don't add board / project-management features to agent-squad. They belong in
board-manager (or another PM plugin).

## Versioning

- `0.x` — contract can shift. Mark intent in CHANGELOG.
- `1.0.0` — contract locked. Breaking changes only on majors.
- Domain skills (under `skills/domain/`) version independently of the construct.
- Always declare `construct_version` (or a range like `">=0.1.0"`) in skill
  frontmatter — the validator enforces semver shape.

## Stuck on the Windows file mount?

When the Write tool silently truncates a file at a non-ASCII byte (em-dash,
arrow, box-drawing char), recover by re-writing the full file via bash
heredoc:

```bash
cat > /sessions/<session>/mnt/.../path/to/file.js <<'EOF'
... full clean content with no em-dashes in code ...
EOF
```

The full session details are in [`SESSION_HANDOFF.md`](SESSION_HANDOFF.md).
