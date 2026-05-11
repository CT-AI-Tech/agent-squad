# Lifecycle hooks

Skills, projects, and the construct itself can register handlers for named
lifecycle events. Event names and the context payload shape are part of the
public contract.

## Event names (v0.1)

| Event | Fires |
|---|---|
| `pre-implement` | After `start-feature` succeeds, before any file edit by the Implementer |
| `post-implement` | After Implementer's last edit, before `finish-feature` is invoked |
| `pre-pr` | Inside `finish-feature`, before `gh pr create` runs |
| `post-pr` | After PR is opened, before the issue is moved to PR Review |

## Context payload

Every hook handler receives a JSON payload with the following shape (additive
fields may appear in minor versions; existing fields are stable contract):

```json
{
  "construct_version": "0.1.0",
  "event": "pre-pr",
  "issue_number": 42,
  "branch": "feature/42-stow-rs-endpoint",
  "role": "backend-dev",
  "persona": "implementer",
  "skills": ["python", "fastapi", "postgres"],
  "lanes": {
    "write": ["app/api/", "app/services/", "tests/"],
    "read":  []
  },
  "diff": {
    "files_changed": ["app/api/stow.py", "tests/test_stow.py"],
    "additions": 142,
    "deletions": 8
  },
  "project": {
    "repo": "owner/repo",
    "default_branch": "main"
  }
}
```

Handlers communicate via exit code and stdout:

- exit `0` — pass, continue workflow
- exit `1` — block, abort workflow with stdout shown to the user
- exit `2` — warn, continue but surface stdout in the PR body

## Hook registration

A skill registers hooks via its `SKILL.md` frontmatter:

```yaml
hooks:
  pre-implement: hooks/check-contract-exists.js
  pre-pr: hooks/validate-tenant-scoping.py
```

Paths are relative to the skill's directory. Handlers MAY be in any language —
the contract is process-based (stdin = JSON payload, exit code, stdout).

A project registers hooks via `.ai-dlc.yml`:

```yaml
hooks:
  branch_guard: enabled
  rebase_guard: enabled
  custom:
    - event: pre-pr
      handler: ./scripts/multi-tenant-check.sh
```

## Hooks config schema

The `.ai-dlc.yml` `hooks:` block:

```yaml
hooks:
  <built-in-hook-name>: enabled | warn | disabled

  custom:                                    # optional
    - event: pre-implement | post-implement | pre-pr | post-pr
      handler: <path-to-handler>
      mode: enabled | warn | disabled        # optional, default enabled
```

Built-in hook names (v0.1):

| Name | Default | Purpose |
|---|---|---|
| `branch_guard` | `enabled` | Blocks edits on protected branches; enforces lane discipline at commit time |
| `rebase_guard` | `enabled` | Auto-rebases the feature branch onto the project default branch before each commit |

Each accepts:
- `enabled` — hook runs and may block
- `warn` — hook runs, prints warning, never blocks
- `disabled` — hook skipped entirely (use sparingly; weakens contract)

## Ordering

When multiple handlers register for the same event, they run in this order:

1. Construct hooks (built-in: `branch_guard`, `rebase_guard`)
2. Skill hooks (in role-declared skill order)
3. Project custom hooks (in declaration order)

A failing earlier hook short-circuits the rest unless its mode is `warn`.

## Stability

The four event names listed above (`pre-implement`, `post-implement`, `pre-pr`,
`post-pr`) and the context payload field set are stable for v0.x. Adding new
events is a minor bump. Removing or renaming events is a major bump. Removing
fields from the payload is a major bump.
