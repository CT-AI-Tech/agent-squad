# agent-squad

Organisation-wide agent construct for AI-assisted software delivery.

`agent-squad` defines the **behaviour contract** for AI engineering agents — what
roles exist, how they hand off work, how they review themselves, and how a project
plugs in domain knowledge. It does **not** know about your project board, your
language stack, or your domain. Those layer on top.

## The three-layer model

```
Persona (behaviour)  +  Skills (knowledge)  +  Lanes (file scope)  =  Role
```

- **Persona** — *how* an agent works. Three are defined: `lead`, `architect`, `implementer`.
- **Skills** — *what* an agent knows. Pluggable (`aws`, `python`, `react`, `dicom`, ...).
- **Lanes** — *where* an agent may write files. Declared per-role at the project level.
- **Role** — a project-specific composition of one persona + N skills + lane scope.
  Example: `backend-dev = implementer + [python, fastapi, postgres] + [app/api/, tests/]`.

The construct ships personas, the role schema, the self-review format, and lifecycle
hooks. Projects compose roles in their own `AGENTS.md`. Org-wide skills live in
`skills/domain/`.

## What this is not

- Not a project manager. See [`ai-dlc-board-manager`](../ai-dlc-board-manager) for that.
- Not a code generator. Personas describe behaviour, not output.
- Not opinionated on language. The contract surface is YAML/Markdown only.

## Layout

```
agent-squad/
├── CONTRACT.md             # public, semver-bound contract surface
├── personas/               # lead.md, architect.md, implementer.md
├── skills/
│   ├── core/               # construct-owned skills (implement, finish-feature)
│   └── domain/             # org-wide domain skills (aws, python, ...)
├── contract/               # schemas + workflow + governance + self-review format
├── hooks/                  # branch-guard, rebase-guard
├── examples/               # project AGENTS.md.example, .ai-dlc.yml.example
└── .claude-plugin/         # Claude Code plugin manifest
```

## Adopting agent-squad in a project

See [QUICKSTART.md](QUICKSTART.md).

## Versioning

Strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).
Skills declare their minimum construct version. Breaking changes only on majors.

## Status

Pre-1.0. Contract may shift in 0.x releases. Stabilises at v1.0.
