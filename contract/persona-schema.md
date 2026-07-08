# Persona file schema

Every file in `personas/` MUST start with YAML frontmatter conforming to this
schema. Fields marked **required** are part of the public contract.

## Frontmatter schema

```yaml
---
name: <kebab-case>             # required, MUST match filename without .md
version: <semver>              # required, semver of this persona definition
construct_version: <semver>    # required, agent-squad version this persona targets
description: <one-line string> # required, used for tool discovery and routing
owner: <team or handle>        # required
behavior:
  invoked_when: [<string>, ...]   # required, list of trigger conditions
  outputs: [<string>, ...]        # required, list of artefacts the persona produces
  prohibited: [<string>, ...]     # required, list of forbidden actions
default_mode: plan | execute   # required, the persona's starting execution mode
plan_mode_triggers:            # required (may be empty), conditions that force a switch
  - <string>                   #   to plan mode mid-session if default_mode is execute
self_review_format: <path>     # required, path to the persona's self-review template
model: opus | sonnet | haiku | inherit   # optional, suggested model tier for this
                               #   persona's work (see Model hint below)
---
```

## Execution modes

The construct assumes a two-mode runtime — **plan mode** (think, propose, refine
without writing) and **execute mode** (apply changes, run commands). Personas
declare:

- `default_mode` — which mode the persona starts in when a session begins.
  - `plan` for personas whose primary output is decisions/designs (e.g. `architect`)
  - `execute` for personas whose primary output is committed code or governance
    actions (e.g. `implementer`, `lead`)
- `plan_mode_triggers` — list of mid-session conditions that MUST cause an
  execute-mode persona to switch back to plan mode. The list is part of the
  persona's behaviour contract; skills MAY surface a trigger via stdout from a
  hook handler and the host SHOULD switch the runtime to plan mode in response.

Plan mode is a runtime concern (the host environment provides it; Claude Code
binds it to `Shift+Tab`). The construct's contribution is declaring **when**
the switch is appropriate — not implementing the switch itself.

## Model hint (optional)

`model` declares the suggested model tier for the persona's kind of work, using
the host vocabulary `opus | sonnet | haiku | inherit`. Resolution when a role
activates: the role-level `model` in the project's AGENTS.md wins, else this
persona default, else unset. The resolved value is written into the session
marker (see [tool-hooks.md](tool-hooks.md)).

The hint is **advisory** on hosts that cannot switch the active session's model
programmatically (Claude Code main sessions — the `session-context` hook
surfaces the hint so the user can run `/model`). It is **binding** where the
host supports per-agent model selection (e.g. delegated subagents).

## Field rules

- `name` MUST match one of the v0.x persona set: `lead`, `architect`, `implementer`.
  Adding a new persona name is a major contract bump (see [CONTRACT.md](../CONTRACT.md)).
- `version` is the persona's own version, independent of `construct_version`.
- `description` SHOULD be under 200 characters. It surfaces in tool listings.
- `behavior.invoked_when` SHOULD be exhaustive — anything not listed is "out of scope".
- `behavior.prohibited` is enforced at the workflow level by skills and hooks.
  Do not list things every persona is prohibited from (those live in `governance.md`).

## Body sections (non-contract, but conventional)

The body of a persona file SHOULD include, in this order:

1. Persona summary (one paragraph)
2. When invoked
3. Responsibilities
4. Allowed lanes (default)
5. Skill affinity
6. Self-review format pointer
7. Hand-off contract (table)

These section headings are convention, not contract — projects MAY render them
differently if needed, but the existing personas in `personas/` follow this
shape and tools may rely on it for documentation generation.

## Validation

CI in `.github/workflows/plugin-ci.yml` runs frontmatter validation on every
file in `personas/`. Validation failures block the PR.
