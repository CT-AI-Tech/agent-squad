# Orchestration — single-session squad dispatch

This document defines how the whole workflow (Lead -> Architect -> Implementer
-> Lead review, see [workflow.md](workflow.md)) executes inside **one host
session**, with the Lead persona acting as a live dispatcher that hands each
task to a named specialist agent — the way a tech lead assigns tickets to a
real team.

The stage order from `workflow.md` is unchanged. Orchestration is a *delivery
mechanism* for those stages, not a replacement. The dispatch protocol, the
rendering blocks, the execution-mode rules, and the branch/PR policy below are
**contract surface**.

---

## Terms

| Term | Meaning |
|---|---|
| Ticket | The issue (or brief file) being dispatched. |
| Task | One unit of work assigned to exactly one role. |
| Dispatch plan | The ordered set of waves the Lead produces at intake. |
| Wave | A group of tasks that run at the same time. A wave of size 1 is sequential work; a wave of size >= 2 runs in parallel. |
| Squad | The roles declared in the project `AGENTS.md`, addressed by `alias` when one is defined, by `name` otherwise. |
| Primary branch | The single feature branch used when the whole plan is sequential. |

---

## Dispatch protocol (normative)

The orchestrating session runs as the **lead** persona and MUST NOT write
application code itself. Every task is delegated to a spawned agent running
the assigned role.

1. **Intake.** Lead reads the ticket, decides design need per workflow Stage 1,
   and renders the *Ticket Intake block*.
2. **Decompose.** Lead splits the ticket into tasks, maps each task to exactly
   one role from `AGENTS.md`, writes a brief per task
   ([brief-format.md](brief-format.md)), and orders tasks into waves using the
   dependency and lane rules below.
3. **Mode decision.** Lead computes the execution mode (sequential / parallel /
   mixed) and renders the initial *Squad Board*.
4. **Design wave (conditional).** If the ticket needs design, the first wave is
   a single Architect task. Its contract PR MUST merge before any implementer
   wave starts (workflow Stage 2 hard rule).
5. **Dispatch loop.** For each wave, in order:
   - Render a *Handoff block* for every task in the wave.
   - Spawn one agent per task (host mapping below). Parallel tasks are spawned
     together; sequential tasks one at a time.
   - On each agent's completion, render its *Return block*.
   - Lead runs the **gate** (below) on each returned task.
   - Re-render the *Squad Board* after every status change.
   - A wave is complete only when every task in it is `approved` (and, in
     parallel mode, merged — see PR policy). Only then may the next wave start.
6. **Finish.** Apply the branch/PR policy below. Lead merges in dependency
   order and closes the issue (implementers never close issues).

### Task status vocabulary

`queued | handed-off | in-progress | returned | changes-requested | approved | merged | halted`

The vocabulary is contract surface; hosts and skills MUST NOT invent parallel
status names.

---

## Visibility contract

Orchestration exists to make delegation *observable*. A Lead that dispatches
silently — spawning agents without rendering the blocks below — violates this
contract.

Every squad member is addressed by its `alias` when one is defined — the Lead
included: the orchestrating session reads `AGENTS.md` before any other work,
adopts the lead role's alias, and speaks under that name in all narration and
blocks for the rest of the session.

Required rendering, in the session transcript, in plain ASCII (markdown tables
and `->` arrows; no emoji, no box-drawing characters):

### Ticket Intake block

Rendered once, before decomposition. Required fields:

```
=== SQUAD DISPATCH: #<issue> =========================
Ticket  : #<issue> <title>
Lead    : <alias (role-name)>
Design? : yes -> <architect role> | no (<reason>)
Tasks   : <count> (see board)
Mode    : sequential | parallel | mixed (<reason>)
======================================================
```

### Squad Board

A markdown table, re-rendered after **every** status transition. Required
columns (order fixed):

```
| Wave | Task | Agent | Lane | Branch | Status |
```

`Agent` is `<alias> (<role-name>)` when an alias is defined. `Branch` shows
the worktree path in parallel mode, e.g. `feature/42-db (.worktrees/42-db)`.

### Handoff block

Rendered immediately before spawning each agent:

```
--- HANDOFF ------------------------------------------
Lead -> <alias> (<role-name>)
Task    : #<issue>.<n> <task title>
Brief   : <path to brief file>
Lane    : <write globs>
Branch  : <branch> [worktree <path>]
Gate    : self-review block + testable check + lane discipline
------------------------------------------------------
```

### Return block

Rendered when the agent completes (or halts):

```
--- RETURN -------------------------------------------
<alias> (<role-name>) -> Lead
Task    : #<issue>.<n>
Result  : done | halted (<reason>)
Tests   : <pass/fail summary>
Verdict : APPROVED | CHANGES REQUESTED (<reason>) | HALTED
------------------------------------------------------
```

The block names, their required fields, and the "render before spawn / after
return / board on every transition" rule are contract surface. Exact column
widths and decoration are not.

---

## Execution modes

### Wave construction rules

Two tasks may share a wave (run in parallel) only if **all** hold:

1. Their roles' `lanes.write` globs are pairwise disjoint.
2. Neither task consumes an artifact the other produces (no dependency edge).
3. Any contract either task depends on is already merged to the default branch
   (contract-first rule).

Tasks that fail any condition are ordered into separate waves by dependency
(producer before consumer; schema before code that queries it; contract before
everything).

The classic shape this produces: DB schema first (wave 1), backend + frontend
in parallel (wave 2), infra last (wave 3), review gate after every agent.

### Sequential mode

Applies when every wave has size 1.

- All agents work in the **main checkout**, one at a time, on the single
  primary branch `feature/<issue>-<slug>`.
- The session marker (`.agent-squad/session.yml`) is switched to the active
  role before each task so `branch-guard` enforces the correct lane per commit.
- One PR at the end, opened via `finish-feature`, containing every task's
  self-review block (one per role, per
  [self-review-format.md](self-review-format.md)).

### Parallel mode (worktrees)

Applies to every wave of size >= 2. Each task in the wave gets:

- Its own git worktree: `.worktrees/<issue>-<task-slug>`
- Its own branch: `feature/<issue>-<task-slug>`, created from the default
  branch tip (which, by the wave rules, already contains everything the task
  depends on).
- Its own session marker inside the worktree (each worktree has an independent
  `.agent-squad/` directory), so lane enforcement is per-agent.
- Its own PR, opened via `finish-feature` from inside the worktree.

Lead merges the wave's PRs in dependency order; the next wave may only start
after the current wave's PRs are merged. Worktrees are removed
(`git worktree remove`) after merge.

### Mixed plans

If **any** wave in the plan has size >= 2, the whole plan uses per-task
branches and PRs (a size-1 wave is then just a parallel wave of one). This
keeps the branch/PR policy uniform within a ticket: either one branch and one
PR (fully sequential), or one branch and one PR per task (any parallelism).

`.worktrees/` MUST be listed in the project's `.gitignore`.

---

## Subagent contract

Every spawned agent receives, in its instructions:

1. Its **role** (`name`, `alias`) and resolved **persona** file content or path.
2. Its **lane** (`lanes.write` globs) — restated verbatim from `AGENTS.md`.
3. The **brief** path for its task (and the contract path, if any).
4. Its **working directory** (main checkout or worktree path) and **branch**.
5. The list of **skills** its role declares.
6. The required **return format**: the Return block fields plus the persona's
   self-review block.

Every spawned agent MUST:

- Set the session marker for its role before the first edit
  (`node <plugin-root>/bin/squad-session.js set <role> --issue <n>`).
- Work only inside its lane and its assigned working directory.
- Run the brief's testable check before returning.
- Produce the self-review block per [self-review-format.md](self-review-format.md).
- Halt (not improvise) when the brief is ambiguous, the lane is too narrow, or
  the contract is wrong — re-entry rules in `workflow.md` apply.

Spawned agents never merge PRs, never close issues, and never modify
`AGENTS.md` or the dispatch plan. Those are Lead actions.

---

## Gate (Lead review per task)

After each Return block, Lead verifies before approving:

1. Self-review block present and substantive.
2. `git diff --stat` (or the PR file list) matches the role's write lane.
3. Testable check met — run it when non-trivial.
4. In parallel mode: branch rebases cleanly on the default branch.

Verdicts: `APPROVED` (task proceeds to merge / next task starts),
`CHANGES REQUESTED` (same agent is re-dispatched with the feedback appended to
its brief; board status `changes-requested`), `HALTED` (escalated to the
human; board status `halted`; the wave pauses).

A wave, and therefore the ticket, cannot complete with any task not `approved`.

---

## Host mapping (non-normative)

On Claude Code, the natural mapping is:

- Orchestrating session = the Lead persona (`/agent-squad:orchestrate`).
- Spawned agent = a subagent via the Agent tool. The agent description SHOULD
  be `<alias> (<role-name>): <task title>` so the host UI itself shows who is
  working — the board and the host's agent list stay consistent.
- Parallel wave = all Agent calls issued together; sequential = one at a time.
- Worktrees are created by the Lead with `git worktree add` before spawning,
  so paths are deterministic and survive agent failure.

Other hosts may map differently, but the protocol, blocks, and policies above
are host-independent.
