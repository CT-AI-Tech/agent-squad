# Role mapping schema

Projects declare their roles in their own `AGENTS.md` by composing personas and
skills with file-lane scopes. This file defines the schema. The schema is part
of the public contract — breaking changes only on a major bump.

## YAML grammar

The `AGENTS.md` file is a Markdown document. The role declarations are a YAML
block fenced as ```yaml inside the file. CI validates this block.

```yaml
construct_version: <semver-range>   # required, agent-squad version this project targets

roles:
  - name: <kebab-case>              # required, unique within file
    alias: <free-form string>       # optional, human-friendly name
    persona: lead | architect | implementer   # required
    skills: [<skill-name>, ...]     # required, may be empty for lead
    lanes:                          # required (lead may use the default)
      write: [<glob>, ...]          # required, files this role may modify
      read:  [<glob>, ...]          # optional, files this role explicitly may read
                                    # (defaults to "everything readable")
    hooks_overrides:                # optional, per-role hook overrides
      pre-implement: enabled | warn | disabled
      ...

contract_first:                     # optional, project-level contract-first config
  required_for:
    - feature_kind: api | schema | event | iac
      contract_path: docs/contracts/<feature>.{md,ts,yaml}
```

## Field rules

### `name`
- Kebab-case, unique within the file.
- Used as the role token in briefs and lane validation.
- Reserved names: `lead` (always maps to the lead persona).

### `persona`
- MUST be one of the construct's persona names.
- One persona per role. A role cannot mix personas.

### `skills`
- Each entry MUST resolve to a skill present in `skills/core/` or `skills/domain/`.
- The role validator MUST reject a role that uses a skill whose
  `persona_affinity` excludes the role's persona.

### `lanes.write`
- List of glob patterns. Files matching any pattern are within the role's lane.
- Globs use the standard `**`/`*`/`?` syntax.
- The `branch-guard` hook enforces that commits modify only files matching this list.
- `lanes.write` of `[]` is legal (lead with no write lane is the default — Lead
  uses the persona's default lane).

### `lanes.read`
- Optional. If present, restricts reads to listed globs.
- Most projects omit this — Implementers and Architects routinely read across
  the repo to understand context. Restrict only if you have a specific reason.

### `hooks_overrides`
- Per-role override of the project's `.ai-dlc.yml` hook config.
- Useful when one role legitimately needs a hook relaxed (e.g. devops-engineer
  rebasing through merge conflicts on `cdk/` regenerated files).

## Conflict resolution

If two roles' `lanes.write` overlap, the role validator emits a warning. Overlap
is sometimes legitimate (e.g. tests/ shared between backend-dev and db-engineer)
but more often indicates the decomposition is wrong.

## Aliases

`alias` is purely cosmetic. It does not affect validation or routing. Projects
that use named personas internally (Pradhan, Mula-lekhaka, etc.) declare them
as aliases and map them to construct personas.

## Example

See [`examples/AGENTS.md.example`](../examples/AGENTS.md.example) for a complete
project file.

## Reserved keys

The following top-level keys in the YAML block are reserved for future contract
extensions and MUST NOT be used by projects:

- `personas` (will hold per-project persona overrides if/when added)
- `policies` (will hold cross-cutting governance overrides)
