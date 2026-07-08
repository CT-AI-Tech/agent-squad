---
name: init
version: 0.1.0
construct_version: ">=0.3.0"
description: Scan a project's plan docs and tech stack, then generate a draft AGENTS.md role composition plus .ai-dlc.yml. Use when adopting agent-squad in a project that has no AGENTS.md yet.
persona_affinity: [lead]
domain: core
owner: agent-squad-core
---

## Description

The `init` skill bootstraps agent-squad adoption in a consumer project. It
scans what the project already has (plan documents, README, tech manifests),
composes a candidate `AGENTS.md` from the role-template library in
[`examples/roles/`](../../examples/roles/), validates it with the construct's
own validator, and scaffolds `.ai-dlc.yml`.

The output is a **draft for human review**. Every inferred role, skill, and
lane is a guess to be confirmed - flag them all in the final summary.

## When this skill applies

Auto-triggers when the user invokes `/agent-squad:init`, or asks to "set up
agent-squad", "create an AGENTS.md for this project", or similar.

## Boundaries

- **Never overwrite an existing `AGENTS.md`.** If one exists, ask the user
  first; if they decline (or you cannot ask), write to `AGENTS.md.draft`
  instead and say so.
- **Never create plan documents.** Creating a ProjectPlan.md from specs is
  `ai-dlc-board-manager:spec-to-plan`'s job. This skill only READS whatever
  plan artifacts already exist.
- **Read-only scan.** The only files this skill writes are `AGENTS.md` (or
  `AGENTS.md.draft`), `.ai-dlc.yml` (only if absent), and - on explicit
  confirmation - the project's `.claude/settings.json` statusline entry.

## Steps

### 1. Scan the project (read-only)

Read, where present:

- Plan and spec docs: `ProjectPlan.md`, `README.md`, `specs/`, `docs/`,
  `planning/` - extract what the project builds, its components, and any
  team/role hints.
- Tech manifests:

| Evidence | Detected stack |
|---|---|
| `package.json` with `react`/`next` deps | React frontend |
| `package.json` with TypeScript config | TypeScript |
| `pyproject.toml`, `requirements.txt` | Python backend |
| `fastapi` in Python deps | FastAPI |
| `psycopg`/`sqlalchemy`/`asyncpg` deps, `alembic/` | Postgres |
| `Dockerfile*`, `docker-compose*` | Docker |
| `*.tf`, `terraform/`, `infra/` | Terraform (likely AWS) |
| `.github/workflows/` | GitHub Actions |
| `frontend/`, `src/components/` | Dedicated frontend lane |

### 2. Map stack to domain skills

Map each detected technology to a skill under `skills/domain/` (currently:
aws, docker, fastapi, github-actions, postgres, python, react, terraform,
typescript). If a technology has no matching domain skill, leave it out of
`skills:` and note the gap in the summary - do not invent skill names.

### 3. Compose the draft AGENTS.md

Compose from the fragments in `examples/roles/` (lead, cloud-architect,
backend-dev, frontend-dev, devops-engineer), following the schema in
[`contract/role-schema.md`](../../contract/role-schema.md):

- **Always include a `lead` role** (the validator requires one).
- Add one implementer role per detected lane (backend, frontend, devops...).
- Add an architect role only when the project has a real design surface
  (APIs consumed by other teams, IaC, shared schemas).
- **Tailor `lanes.write` to directories that actually exist** in the project.
  Do not copy fragment lanes verbatim if the project layout differs.
- Set `construct_version: ">=0.3.0"`.
- Optionally set per-role `model:` (opus | sonnet | haiku | inherit) when the
  work type clearly warrants it; otherwise rely on persona defaults.

### 4. Validate loop

Run the construct's validator and fix until green:

```
node <plugin-root>/bin/validate-role-schema.js AGENTS.md
```

Do not present a draft that fails validation.

### 5. Scaffold .ai-dlc.yml

If the project has no `.ai-dlc.yml`, copy
[`templates/ai-dlc.yml`](templates/ai-dlc.yml) to the project root.
Never overwrite an existing one.

### 6. Offer statusline wiring

Show the user the snippet for the active-role statusline:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node <plugin-root>/bin/squad-status.js"
  }
}
```

Only on explicit confirmation, merge it into the project's
`.claude/settings.json`. Never touch user-global settings, and never
replace an existing statusLine without asking.

### 7. Summarise

End with a summary listing: roles created (persona, skills, lanes, model),
detected-but-unmapped technologies, and every guess needing human review.
Remind the user the file is a draft and how to validate after editing.

## References

- [`contract/role-schema.md`](../../contract/role-schema.md) - AGENTS.md grammar
- [`examples/roles/README.md`](../../examples/roles/README.md) - fragment library
- [`examples/AGENTS.md.example`](../../examples/AGENTS.md.example) - full example
- [`contract/tool-hooks.md`](../../contract/tool-hooks.md) - session marker + statusline
