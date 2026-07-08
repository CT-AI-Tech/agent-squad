# Tool hooks (host-specific)

Tool hooks fire on every applicable host tool call — not at workflow-stage
transitions. They are the construct's mechanism for **fine-grained enforcement**:
catching a bad action at the moment it happens, not afterwards.

These hooks are **host-specific** because they piggyback on the host's tool-call
lifecycle (e.g. Claude Code's `PreToolUse` event). Hosts that don't expose
tool-call hooks may still use the rest of the construct — they just lose the
real-time enforcement layer and fall back to review-stage checks.

## Distinction from lifecycle hooks

| Category | Fires when | Granularity | Host-portable? |
|---|---|---|---|
| Lifecycle hooks ([`lifecycle-hooks.md`](lifecycle-hooks.md)) | Workflow stage transitions | Once per stage | Yes |
| Tool hooks (this file) | Every applicable tool call | Many per session | No — host-specific |

Both categories MAY exist for the same enforcement concern. Lane discipline
appears in both:
- Tool hook (`branch-guard`) catches lane violations the moment a file edit happens
- Lifecycle hook (in `validate-self-review`) re-checks lane discipline at PR time

The redundancy is intentional — different hosts give different guarantees, and
the lifecycle layer is the floor that always applies.

## Currently defined tool hooks (v0.4)

| Name | Fires on | Purpose |
|---|---|---|
| `branch-guard` | Write, Edit | Block edits on protected branches; enforce role lane discipline when an active-role marker is present |
| `rebase-guard` | Bash | Detect `git commit` invocations and auto-rebase the feature branch onto the project default branch before the commit lands |
| `session-context` | UserPromptSubmit, SessionStart | Inject a one-line description of the active role (persona, role, issue, model hint) into the model's context so the agent knows and announces which persona it is operating as. Informational only — never blocks (always exit 0). Silent when no marker exists |
| `usage-tracker` | Stop | Record actual token usage per feature: parse the session transcript and update the per-issue ledger (`.agent-squad/usage.json`). Informational only — never blocks (always exit 0). Silent when no marker/issue is active |

The script files live in [`hooks/`](../hooks/) at the construct root. Their
exit codes follow the host's convention:

- Claude Code: `0` = allow, `2` = block (message in stdout is shown to the
  agent), `1` reserved for hook script errors.

## Active-role marker

For lane discipline, `branch-guard` reads an optional marker file at
`.agent-squad/session.yml` in the project repo. The marker is a **resolved
snapshot** of the active role — the `pre-implement` hook
(`check-brief-and-contract`) reads `AGENTS.md` and writes the snapshot here so
downstream hooks don't need to re-parse it on every tool call.

**Any persona may hold the marker.** The implementer flow writes it
automatically (pre-implement). Lead and Architect flows write it via the
`squad-session` CLI when they activate, and clear it on hand-off:

```
node <plugin-root>/bin/squad-session.js set <role-name> [--issue N]
node <plugin-root>/bin/squad-session.js clear
```

Exactly one role is active per session at a time — writing the marker replaces
any previous one. `bin/squad-status.js` renders the marker as a statusline
line (`[agent-squad] implementer:backend-dev #42 (sonnet)`); it prints nothing
when no marker exists.

```yaml
# .agent-squad/session.yml
# Written by: skills/core/implement/hooks/check-brief-and-contract.js (pre-implement)
# Cleared by: skills/core/finish-feature/hooks/move-to-pr-review.js (post-pr)
construct_version: 0.1.0
role: backend-dev
issue: 42
persona: implementer
skills:
  - python
  - fastapi
  - postgres
write_lanes:
  - app/api/
  - app/services/
  - tests/
read_lanes:
  - docs/contracts/
  - docs/architecture/
```

- If the marker exists: `branch-guard` matches changed files against
  `write_lanes` directly. No AGENTS.md re-parsing.
- If the marker is absent: `branch-guard` enforces only the protected-branch
  rule. Lane enforcement is silently skipped (the implementation may opt to
  emit a one-shot stderr notice the first time per session).

The marker is gitignored by default (the construct's `.gitignore` template adds
`.agent-squad/session.yml`, the archived `session.*.yml` copies, and the usage
ledger `usage.json`). It is local to each agent session.

### Schema (contract)

| Field | Type | Required | Notes |
|---|---|---|---|
| `construct_version` | string (semver) | yes | agent-squad version that wrote the marker |
| `role` | string | yes | role name from project AGENTS.md |
| `issue` | string \| number | optional | issue ref if applicable |
| `persona` | string | yes | one of `lead`, `architect`, `implementer` |
| `skills` | list of strings | yes (may be empty) | skill names |
| `write_lanes` | list of globs | yes | resolved from role.lanes.write |
| `read_lanes` | list of globs | optional | resolved from role.lanes.read |
| `model` | string | optional | resolved model hint: role `model` if set, else persona frontmatter `model`. One of `opus`, `sonnet`, `haiku`, `inherit` |
| `estimate` | string | optional | size class from the brief frontmatter (`S`, `M`, `L`, `XL`), copied by the pre-implement hook; absent for lead/architect markers (no brief). See [`brief-format.md`](brief-format.md) |

## Host registration

Tool hooks are not registered through `.ai-dlc.yml` — they are wired into the
host's hook system at install time. For Claude Code, the plugin manifest
declares which tool events each hook listens to:

```json
{
  "hooks": [
    {
      "script": "hooks/branch-guard.js",
      "events": ["PreToolUse:Write", "PreToolUse:Edit"]
    },
    {
      "script": "hooks/rebase-guard.js",
      "events": ["PreToolUse:Bash"]
    },
    {
      "script": "hooks/session-context.js",
      "events": ["UserPromptSubmit", "SessionStart"]
    },
    {
      "script": "hooks/usage-tracker.js",
      "events": ["Stop"]
    }
  ]
}
```

Projects MAY disable a tool hook via the same `.ai-dlc.yml` `hooks:` block as
lifecycle hooks — the mode keys are shared:

```yaml
hooks:
  branch_guard: enabled | warn | disabled
  rebase_guard: enabled | warn | disabled
  session_context: enabled | warn | disabled
  usage_tracker: enabled | warn | disabled
```

Disabled tool hooks skip on entry (exit 0 immediately). Warn mode logs and
allows. For `session-context` and `usage-tracker` (informational, never
block) `warn` behaves the same as `enabled`.

## Usage ledger (`.agent-squad/usage.json`)

The `usage-tracker` hook maintains a per-issue token ledger:

```json
{
  "issues": {
    "42": {
      "sessions": {
        "<session-id>": {
          "input": 81234,
          "output": 14567,
          "cache_read": 1204000,
          "cache_create": 88000
        }
      }
    }
  }
}
```

Semantics (contract):

- On every Stop event with an active marker carrying an `issue`, the hook
  recomputes THIS session's cumulative totals from the transcript and
  **overwrites** its `sessions.<session-id>` entry — repeated Stop events
  never double-count.
- Multiple sessions (Architect design session, Implementer session, a
  resumed session) accumulate as separate entries under the same issue; the
  feature total is the sum across sessions. `move-to-pr-review` emits that
  sum as a `USAGE_TOTAL` line at PR time.
- Caveats: totals are session-scoped approximations — every turn of a
  session holding the marker counts toward the issue, including triage
  chatter. The ledger is Claude Code-specific (transcript parsing); other
  hosts get no ledger and everything downstream degrades to a no-op.

Like the session marker, `usage.json` is local to the repo clone and
gitignored by default — the durable record is the `### Token usage` note the
skill puts in the PR body.

## Contract scope

The following are part of the public contract:

1. The four named tool hooks: `branch-guard`, `rebase-guard`,
   `session-context`, `usage-tracker`.
2. The `.agent-squad/session.yml` marker file format (fields `role`, `issue`,
   `construct_version`, `model`, `estimate`).
3. The `.ai-dlc.yml` `hooks:` mode key names (shared with lifecycle hooks).
4. Exit code semantics under each supported host.
5. The `squad-session` CLI semantics: any persona may write/clear the marker
   (`set <role-name>` resolves the role from the project AGENTS.md; `clear`
   removes the marker).
6. The usage ledger schema (`.agent-squad/usage.json`:
   `issues.<issue>.sessions.<session-id>.{input,output,cache_read,cache_create}`)
   and the `USAGE_TOTAL` stdout line emitted by `move-to-pr-review`.

What is **not** contract:

- The internal implementation of each hook script.
- Whether the host invokes the hook from stdin payload, environment, or other
  channel (host-specific).
- Additional tool hooks a project may register; those are project-private.
