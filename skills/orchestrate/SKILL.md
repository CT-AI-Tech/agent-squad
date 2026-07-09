---
name: orchestrate
version: 0.2.0
construct_version: ">=0.1.0"
description: The Lead's dispatch loop. Reads a ticket, decomposes into tasks, hands each to a named squad agent (visible handoff blocks + live squad board), runs them sequentially on one branch or in parallel via git worktrees, gates every return.
persona_affinity: [lead]
domain: core
owner: agent-squad-core
---

## Description

`orchestrate` turns a single session into the whole team. The session runs as
the **Lead** persona and never writes application code: it reads the ticket,
decides who does what, and visibly hands each task to a spawned specialist
agent — exactly like a tech lead assigning tickets. Every handoff, return, and
status change is rendered per [contract/orchestration.md](../../contract/orchestration.md).

The full workflow (Lead -> Architect -> Implementer -> Lead review) executes
in this one session; the stage order from `contract/workflow.md` is preserved.

## When this skill applies

Auto-triggers on `/agent-squad:orchestrate <issue-number | brief-path>`.

Refuses to run when:
- The project has no `AGENTS.md` role mapping (run `/agent-squad:init` first).
- The ticket/brief cannot be found or is placeholder-only.

## Lead mode

Your FIRST action — before narrating anything about the ticket — is reading
`AGENTS.md` to learn who you are. If the lead role declares an `alias`, you
are that person for the whole session: introduce yourself by name as soon as
you know it ("Pradhan (lead): taking #12 through intake") and speak as that
alias in every subsequent turn, handoff, board rendering, and verdict. Never
refer to yourself as "the Lead" or "the orchestrator" when an alias is
defined — the named roster is how the user tracks who is speaking. Keep any
text before the AGENTS.md read to one neutral sentence at most.

Do not edit application files — the Write/Edit lane for this session is the
lead lane only (briefs, ADRs, board renderings, `AGENTS.md`).

### 1. Intake

1. Read `AGENTS.md` (roles, aliases, lanes, models) and `.ai-dlc.yml`; adopt
   the lead alias from here on.
2. Read the ticket: `gh issue view <n>` (or read the brief file).
3. Set the session marker:
   `node <plugin-root>/bin/squad-session.js set <lead-role> --issue <n>`
4. Decide per workflow Stage 1: implementable? needs design? decomposes?
5. Render the **Ticket Intake block** (format in `contract/orchestration.md`).
   If the brief is not implementable, stop here and return the ticket with a
   comment — do not dispatch.

### 2. Decompose and plan

1. Split into tasks; assign each task exactly one role from `AGENTS.md`.
2. Write one brief per task (`briefs/<issue>-<n>.md`, per
   `contract/brief-format.md`) including the testable check.
3. Build waves using the rules in `contract/orchestration.md#wave-construction-rules`:
   disjoint write lanes + no dependency edge + contract already in main =>
   same wave. Typical shape: schema first, backend + frontend parallel, infra
   last.
4. Decide mode: every wave size 1 => **sequential** (one branch, one PR);
   any wave size >= 2 => **parallel** (worktree + branch + PR per task).
5. Render the initial **Squad Board** and state the mode decision in one
   sentence. Pause for the user only if the decomposition changes ticket scope;
   otherwise proceed.

### 3. Design wave (only if needed)

Spawn the Architect role first as its own wave. Its contract PR must be merged
to the default branch before any implementer wave starts. Gate it like any
other task.

### 4. Dispatch loop

**Board mirroring (once, before the first handoff).** If `.ai-dlc.yml` wires
a project board, move the ticket to Agent Work through the PM plugin's board
provider (ai-dlc-board-manager) — and at finish, let `finish-feature`'s
`post-pr` hook move it to PR Review as usual. The construct's Squad Board is
rendered either way; the GitHub board is the PM plugin's surface and must not
be left stale.

For each wave in order:

**Prepare branches.**
- Sequential plan: once, at the start —
  `git checkout -b feature/<issue>-<slug> origin/<default>`.
- Parallel plan: per task —
  `git worktree add .worktrees/<issue>-<task-slug> -b feature/<issue>-<task-slug> origin/<default>`.
  Ensure `.worktrees/` is in `.gitignore`.

**Hand off.** For each task in the wave, render the **Handoff block**, then
spawn one subagent via the Agent tool — always synchronous
(`run_in_background: false`); never park a task on a background execution.
Parallel wave: spawn all tasks as synchronous Agent calls in a single message
so they run concurrently and the turn resumes when all have returned. Agent
description: `<alias> (<role-name>): <task title>`.

Subagent prompt template (fill every placeholder; paste lane globs verbatim
from `AGENTS.md`):

```
You are <alias>, the <role-name> on this squad.
Persona: read <plugin-root>/personas/<persona>.md and follow it.
Skills for this role: <skill list — read each skills/<name>/SKILL.md that exists>.

Working directory: <abs path — main checkout or worktree>. Work ONLY there.
Branch: <branch>. Never touch the default branch.
Write lane (hard limit, enforced by branch-guard): <lanes.write globs>

Task #<issue>.<n>: <task title>
Brief: read <abs brief path> first. Contract (if listed there) is already in
main — read it and do not change it.

Before your first edit:
  node <plugin-root>/bin/squad-session.js set <role-name> --issue <issue>

Then: implement per the brief, write tests for the testable check, run them,
commit at logical checkpoints.
<parallel mode only: finish by running /agent-squad:finish-feature <issue> from
your worktree to open your PR.>
<sequential mode only: do NOT open a PR; commit on the shared branch and stop.>

Return exactly:
Result: done | halted (<reason>)
Tests: <command run + pass/fail counts>
Files changed: <list>
<your persona's self-review block per contract/self-review-format.md>

Halt instead of improvising if the brief is ambiguous, your lane is too
narrow, or the contract is wrong. Never merge, never close issues.
```

**Collect and gate.** As each agent returns:
1. Render its **Return block**.
2. Gate per `contract/orchestration.md#gate`: self-review substantive; diff
   files within lane (`git diff --stat <base>...<branch>` or the PR file
   list); testable check met (run it when cheap).
3. Verdict `APPROVED`: proceed. `CHANGES REQUESTED`: append the feedback to
   the task brief and spawn a **fresh** agent for the same role (new Handoff
   block, labelled "round 2"). Everything the fix round needs is in the
   brief, the branch, and the diff. Do NOT SendMessage or resume the finished
   agent — a completed agent has no active task, the host "resumes" it
   detached in the background, and its result never reaches this loop (this
   is exactly the stall the recovery rules below exist for). `HALTED`: pause
   the wave and surface to the user.
4. Re-render the **Squad Board** after every transition.

**Recover lost agents.** If a spawn ends without a Return (host notification
says stopped / killed / "no completion record", or a background execution you
did not intend), do not wait: treat the task as `halted`, inspect the agent's
working directory (`git status`, `git log`, diff vs the wave base) to see
what landed, render a Return block on the agent's behalf
(`Result: halted (lost agent; salvaged from working tree)`), gate whatever
was committed, and re-dispatch the remainder as a fresh agent with the brief
updated to say what is already done. Never leave the user watching a task
that nothing is working on.

**Close the wave.** Parallel mode: merge the wave's PRs in dependency order,
then `git worktree remove .worktrees/<issue>-<task-slug>` for each. The next
wave starts only after all merges land.

### 5. Finish

- Sequential plan: run `/agent-squad:finish-feature <issue>` once from the
  primary branch. The PR body carries one self-review block per role that
  worked on the branch.
- Parallel plan: PRs were opened per task; after the last wave's merges, close
  the parent issue and render the final Squad Board (all tasks `merged`).
- Clear the marker: `node <plugin-root>/bin/squad-session.js clear`.

## Visibility rules (non-negotiable)

- Never spawn an agent without a Handoff block immediately before it.
- Never absorb an agent's result silently — always a Return block + verdict.
- The Squad Board is the single source of truth the user watches; re-render it
  on every status change, using the status vocabulary from
  `contract/orchestration.md` only.
- Address agents by alias — including yourself. "Pradhan -> Dharak
  (db-engineer)" reads like a team; "the Lead is running subagent 2" does not.
- Never end a turn while a task is `in-progress` without the current Squad
  Board plus one line saying what you are waiting on and where the user can
  watch (branch, worktree path, board URL).

## References

- [`contract/orchestration.md`](../../contract/orchestration.md) — dispatch protocol, block formats, mode rules (contract surface)
- [`contract/workflow.md`](../../contract/workflow.md) — the stage order this skill executes
- [`contract/brief-format.md`](../../contract/brief-format.md) — per-task briefs
- [`personas/lead.md`](../../personas/lead.md) — the persona this skill decorates
- [`skills/finish-feature/SKILL.md`](../finish-feature/SKILL.md) — PR step invoked per mode
