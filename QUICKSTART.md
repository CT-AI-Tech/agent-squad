# QUICKSTART — Adopting agent-squad in a project

This guide walks you from zero to a working role-mapped project.

## 1. Install

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

## Troubleshooting

- *Lane validation fails on commit* — branch-guard blocks edits to files outside
  your role's `write` lane. If this is intentional, get Lead to widen the lane in
  `AGENTS.md`. Don't disable the hook silently.
- *Skill doesn't auto-trigger* — check `persona_affinity` in the skill's frontmatter
  matches your current role's persona.
- *Self-review section missing on PR* — `finish-feature` will refuse to open the PR
  until the self-review template is filled. See [`contract/self-review-format.md`](contract/self-review-format.md).
