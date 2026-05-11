# QUICKSTART — Adopting agent-squad in a project

This guide walks you from zero to a working role-mapped project.

## 0. Install agent-squad's own dependencies (once)

The construct uses `js-yaml` in its validators and skill hooks. Install once
in the agent-squad directory:

```bash
cd /path/to/agent-squad
npm install
```

This creates `node_modules/` that the hook scripts and validators resolve at
runtime. Skip this step and the hooks will print a clear error telling you to
run it.

## 1. Install agent-squad as a plugin

Install `agent-squad` as a Claude Code plugin in your project repo:

```bash
# from the repo root of your project
claude plugin install agent-squad
```

This adds the construct's personas, core skills, hooks, and the role schema.

## 2. Create your project's AGENTS.md

Copy [`examples/AGENTS.md.example`](examples/AGENTS.md.example) to your repo root
as `AGENTS.md`. This file is **project-owned** — it declares the roles your team
needs by composing personas + skills + lanes.

```yaml
roles:
  - name: backend-dev
    persona: implementer
    skills: [python, fastapi]
    lanes:
      write: [app/api/, app/services/, tests/]
      read:  [docs/contracts/, docs/architecture/]
```

See [`contract/role-schema.md`](contract/role-schema.md) for the full schema.

## 3. (Optional) Add `.ai-dlc.yml` for hooks

If you use the board manager or want hook control, copy
[`examples/.ai-dlc.yml.example`](examples/.ai-dlc.yml.example) and edit. Each
hook can be `enabled` (default), `warn`, or `disabled`.

## 4. Pick the skills your project needs

Skills live in `agent-squad/skills/domain/`. Reference them by name in your roles.
Skills declare which persona they decorate (`persona_affinity`) — if a skill is
implementer-only and you reference it from an architect role, the role validator
will warn you.

## 5. Run your first feature

If your project also uses `ai-dlc-board-manager`:

```bash
# Lead session
/ai-dlc-board-manager:start-feature 42

# Architect session (only if Lead's brief calls for design)
# Architect drafts contract to docs/contracts/<feature>.* — gets to main first

# Implementer sessions (parallel, one per lane)
/agent-squad:implement 42-backend
/agent-squad:implement 43-frontend

# Each Implementer wraps with:
/agent-squad:finish-feature
```

Without the board manager, the same skills work — you just create issues and
branches manually.

## 6. Read the contract

Before writing your own skill or persona override, read [CONTRACT.md](CONTRACT.md)
and [`contract/`](contract/). The contract surface is small on purpose; everything
else is internal and may move.

## Verifying agent-squad itself

Before pushing changes to agent-squad, run the local CI dry-run from its repo:

```bash
cd /path/to/agent-squad
bash tests/ci-dry-run.sh
```

This runs the same checks the GitHub workflow runs — manifest validity, hook
syntax, persona and skill frontmatter, the example AGENTS.md role schema, and
31 smoke tests across all hooks and validators.

## Troubleshooting

- *Lane validation fails on edit* — `branch-guard` blocks edits to files
  outside the active role's `write` lane (read from `.agent-squad/session.yml`).
  If the violation is intentional, ask Lead to widen the lane in `AGENTS.md`.
  Don't disable the hook silently.
- *Hook errors with "js-yaml not found"* — run `npm install` in the agent-squad
  directory (see step 0).
- *Skill doesn't auto-trigger* — check `persona_affinity` in the skill's
  frontmatter matches your current role's persona.
- *Self-review block rejected on PR* — `finish-feature` invokes
  `validate-self-review` which enforces the per-persona format. Read the rejection
  message — it points at the failing section. See [`contract/self-review-format.md`](contract/self-review-format.md).
- *Session marker not found* — the `pre-implement` hook
  (`check-brief-and-contract`) writes `.agent-squad/session.yml` after validating
  the brief. If the marker is missing, the brief is missing, has no testable
  check, or the role isn't in `AGENTS.md`. The hook output tells you which.
