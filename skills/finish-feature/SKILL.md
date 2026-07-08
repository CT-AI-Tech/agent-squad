---
name: finish-feature
version: 0.1.0
construct_version: ">=0.1.0"
description: Closes the Implementer's loop. Validates self-review block, lane discipline, and rebase. Opens PR, moves issue to PR Review.
persona_affinity: [implementer]
domain: core
owner: agent-squad-core
hooks:
  pre-pr: hooks/validate-self-review.js
  post-pr: hooks/move-to-pr-review.js
---

## Description

The `finish-feature` skill is the Implementer's exit step. It is the dedicated
PR-creation gate — no other skill opens PRs in the construct.

This skill is **persona-aware**: it refuses to run for `architect` or `lead`
roles. Architects open contract or ADR PRs through their own flow (described in
[`personas/architect.md`](../../personas/architect.md)), and Lead opens
governance PRs manually.

## When this skill applies

Auto-triggers when the user invokes `/finish-feature` or when the Implementer's
testable check is verifiably met.

## Implementer mode

At the start of each turn, state your active persona and role (from
`.agent-squad/session.yml`), e.g. "Implementer (backend-dev, #42):" — the user
must always be able to tell which agent is working.

### 1. Pre-flight

- Branch is rebased onto the project's default branch (enforced by `rebase-guard`).
- Files changed are within the role's `write` lane (enforced by `branch-guard`).
- Tests pass (project-defined; the skill calls the project's test runner if declared).

### 2. Self-review block validation (`pre-pr` hook)

The `pre-pr` hook reads the prepared PR body and validates the self-review
block per [`contract/self-review-format.md#implementer`](../../contract/self-review-format.md).

The block MUST contain, with exact section names:

- `## Agent Brief` (testable check pasted verbatim)
- `## Agent self-review — <role-name>`
- `### What I actively checked` (at least 3 items)
- `### Testable Check verification` (`Command run:`, `Output:`, `Result:`)
- `### How to test` (reviewer-facing reproduction steps: at least 2
  steps or 1 command line)
- `### Files changed` (matches `git diff --name-only`)
- `### Tests written or updated` (non-empty)
- `### Issues I found and chose not to fix in this PR` (present, even if
  `No issues found.`)

Failure on any of these blocks the PR. The Implementer fixes the block and
re-invokes the skill.

### 3. PR creation

The skill commits any remaining changes, pushes the branch, and runs
`gh pr create` with the validated body.

### 4. Issue transition + usage report (`post-pr` hook)

The `post-pr` hook moves the issue from Agent Work to PR Review status. If the
project doesn't use `ai-dlc-board-manager`, that part is a no-op.

It also emits a `USAGE_TOTAL` line (see Implementation notes) when the token
ledger has data for the issue. When present, the skill SHOULD append a short
`### Token usage` note to the PR body comparing the brief's estimate with the
actuals, e.g.:

```
### Token usage
Estimate: M (~50-150k). Actual: input=82k output=14k cache_read=1.2M.
```

This section is optional — the ledger only exists on hosts with a Stop hook
(Claude Code); `validate-self-review` does not require it.

## Lifecycle hooks

| Hook | Handler | Purpose |
|---|---|---|
| `pre-pr` | `hooks/validate-self-review.js` | Validate self-review block per format contract |
| `post-pr` | `hooks/move-to-pr-review.js` | Move issue to PR Review (board-manager integration) |

## References

- [`personas/implementer.md`](../../personas/implementer.md) — persona contract
- [`contract/self-review-format.md`](../../contract/self-review-format.md) — block format
- [`contract/governance.md`](../../contract/governance.md) — rules around PR + self-review
- [`skills/implement/SKILL.md`](../implement/SKILL.md) — what comes before

## Implementation notes

Both handler scripts live in `hooks/` next to this SKILL.md.

`validate-self-review.js` reads the PR body from `payload.pr_body` (if the
calling skill staged it on stdin) or from `.agent-squad/pr-body.md`. It loads
the active role from `.agent-squad/session.yml` (written by the
`pre-implement` hook) and applies the persona-appropriate validation rules
from [`contract/self-review-format.md`](../../contract/self-review-format.md).

`move-to-pr-review.js` archives the session marker (so the next session
starts clean) and emits a structured `NEXT_STEP move_issue_status ...` line
on stdout when `.ai-dlc.yml` indicates a board-manager integration. The
calling skill reads this and performs the column transition in its own
process — this hook does not invoke `gh` or `git` itself.

When `.agent-squad/usage.json` (written by the `usage-tracker` Stop hook)
has entries for the issue, it also emits:

```
USAGE_TOTAL issue=<N> input=<n> output=<n> cache_read=<n> cache_create=<n> [estimate=<S|M|L|XL>]
```

`estimate` is read from the session marker before archiving (copied there
from the brief frontmatter by the `pre-implement` hook).
