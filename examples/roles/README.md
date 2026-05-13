# Role templates

Starter role library for adopting agent-squad. Each `*.role.md` here is a
**role fragment** — copy the yaml entry into your project's `AGENTS.md`
inside the `roles:` list. The files are not themselves standalone
`AGENTS.md` files (the validator requires every `AGENTS.md` to contain at
least one `persona: lead` role, so a single non-lead fragment can't
validate in isolation).

## What's here

| Template | Persona | Skills | Typical lane |
|----------|---------|--------|--------------|
| [`lead.role.md`](lead.role.md) | lead | (none) | docs, ADRs, AGENTS.md |
| [`cloud-architect.role.md`](cloud-architect.role.md) | architect | `aws` | cloud contracts + ADRs |
| [`backend-dev.role.md`](backend-dev.role.md) | implementer | `python`, `fastapi`, `postgres` | `app/`, `tests/` |
| [`frontend-dev.role.md`](frontend-dev.role.md) | implementer | `react`, `typescript` | `frontend/`, `public/` |
| [`devops-engineer.role.md`](devops-engineer.role.md) | implementer | `docker`, `terraform`, `github-actions` | `Dockerfile*`, `infra/`, `.github/workflows/` |

## How to use

### Manual composition

1. Copy `lead.role.md`'s yaml entry into your `AGENTS.md`'s `roles:` list
   (every adopting project needs one).
2. Copy any other entries you want for the roles your project actually has.
3. Edit `name`, `lanes.write`, and `lanes.read` to match your project's
   directory layout.
4. Validate with `node bin/validate-role-schema.js path/to/your/AGENTS.md`.

### Scripted (v0.2.0+)

`bin/scaffold-role.js` reads this directory and merges selected templates
into an `AGENTS.md`. Example:

```powershell
node bin/scaffold-role.js --roles lead,backend-dev,cloud-architect --out ./AGENTS.md
```

## Adding new role templates

Three rules:

1. **One role per file.** A single `- name: ...` yaml entry inside one
   ```yaml fenced block.
2. **Reference real skills.** Each `skills:` entry must resolve to a
   `SKILL.md` under `skills/core/` or `skills/domain/`. If the skill
   doesn't exist yet, ship a stub alongside.
3. **No project-specific lanes.** Use lane paths a reasonable project
   would use (e.g. `app/api/`, not `services/myapp-payments-v2/`). The
   adopter will edit lanes to fit.

## Catalog tier

The current set is intentionally narrow — five canonical roles spanning
all three personas. Broader role variants (Node backend, Angular
frontend, ML, mobile, security, QA, etc.) are deferred until real
adoption signals demand for them. See `~/.claude/plans/` v0.2 plan,
"Deferred" section.

## Related contract docs

- [`contract/role-schema.md`](../../contract/role-schema.md) — full schema
  the yaml fragments must satisfy
- [`contract/persona-schema.md`](../../contract/persona-schema.md) —
  persona-level rules
- [`examples/AGENTS.md.example`](../AGENTS.md.example) — complete
  project-level example combining several role types
