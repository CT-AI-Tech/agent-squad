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

## Reviewing agent PRs as a human

GitHub does not let an account formally review (approve / request changes /
inline suggestions) a PR that same account opened. If `finish-feature`
creates PRs with your own `gh` login, you are locked out of reviewing your
agents' work.

Fix: give the squad a single bot identity. Create one machine account, grant
it write access to your project repo, issue it a fine-grained token
(Pull requests: read/write, scoped to the repo), and expose that token as
`AGENT_SQUAD_GH_TOKEN` in your environment. `finish-feature` then uses it for
`gh pr create` only — commits and pushes keep your normal credentials — and
the PR lands authored by the bot, ready for you to review like any
teammate's.

Step-by-step token setup is in [QUICKSTART.md](QUICKSTART.md) (step 3a);
the contract definition is in
[`contract/workflow.md`](contract/workflow.md#pr-author-identity).

## Versioning

Strict semver on the contract surface defined in [CONTRACT.md](CONTRACT.md).
Skills declare their minimum construct version. Breaking changes only on majors.

## Status

**v0.5.0 — contract complete, enforcement active, tool hooks wired into Claude Code, agent PRs reviewable by humans.**

- All three personas defined with behaviour, lanes, plan-mode triggers, and self-review formats.
- Construct hooks (`branch-guard`, `rebase-guard`) and skill lifecycle hooks (`check-brief-and-contract`, `validate-self-review`, `move-to-pr-review`) are fully implemented.
- Optional bot identity (`AGENT_SQUAD_GH_TOKEN`) so `finish-feature` opens PRs the human operator can formally review.
- CI validates manifest, frontmatter, role schema, hook syntax, and runs smoke tests.
- Pre-1.0: contract surface may evolve in 0.x. Locks at v1.0.

Run `bash tests/ci-dry-run.sh` to verify everything works locally before pushing.
