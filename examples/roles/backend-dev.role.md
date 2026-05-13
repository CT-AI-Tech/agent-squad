# Role template — backend-dev

Copy the yaml entry below into the `roles:` list inside your project's
`AGENTS.md`. Backend implementation lane for Python + FastAPI + Postgres
stacks. The Implementer consumes a locked API contract from
`docs/contracts/`; do not start until the contract is in `main`.

```yaml
- name: backend-dev
  persona: implementer
  skills: [python, fastapi, postgres]
  lanes:
    write:
      - app/api/
      - app/services/
      - app/tasks/
      - app/schemas/
      - tests/
    read:
      - docs/contracts/
      - docs/architecture/
```

## When to use this role

Server-side feature work in a Python web service. The role assumes a
FastAPI app shape with the lanes shown — adjust paths if your project
uses a different layout.

## What it does

- Reads the brief in `briefs/<issue>.md` and the locked contract
- Writes endpoints, services, schemas, and matching tests
- Stays inside the write lane — does not touch migrations
  (`db-engineer`'s lane) or frontend code (`frontend-dev`'s lane)
- Self-reviews per `contract/self-review-format.md` before invoking
  `finish-feature`

## Common variations

- **Django stack**: swap `fastapi` skill for `django`. Adjust lane paths
  to match Django app layout (e.g. `myapp/views/`, `myapp/models/`).
  `django` skill not yet shipped — would need to be added under
  `skills/domain/django/`.
- **Flask stack**: swap to `flask`. Same caveat — `flask` skill not yet
  shipped.
- **Async-heavy services**: keep `fastapi`; consider adding `asyncio` or
  `anyio` as additional skills if patterns warrant separate documentation.

## Skills implied

- `python` — language patterns, typing, exception handling
- `fastapi` — request validation, dependency injection, response models
- `postgres` — query patterns, index choices, JSONB usage
- (Migrations not in this lane — see `db-engineer` role)
