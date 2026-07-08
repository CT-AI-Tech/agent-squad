# Workflow — Lead → Architect → Implementer

The end-to-end agent workflow. The sequence and stage definitions are part of
the public contract. Skills and projects MAY refine each stage but MUST NOT
skip stages or invert the order.

---

## Stage map

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │                                                                      │
   │   Lead                                                               │
   │   ─ Reads issue                                                      │
   │   ─ Decides:                                                         │
   │       (a) needs design? ───────► branch to Architect ─┐              │
   │       (b) needs decomposition? ──► split into          │              │
   │                                    per-lane sub-issues │              │
   │       (c) ready to implement? ──► assign Implementers  │              │
   │   ─ Writes Agent Brief in issue body                  │              │
   │                                                       ▼              │
   │   Architect (only if "needs design")                                  │
   │   ─ Drafts contract → docs/contracts/<feature>.*                      │
   │   ─ Drafts ADR     → docs/adr/<NNNN>-<title>.md                       │
   │   ─ Refinement loop with Lead until signed off                        │
   │   ─ Contract PR merged to main BEFORE any Implementer starts          │
   │                       │                                               │
   │                       ▼                                               │
   │   Implementer(s) — possibly N in parallel                             │
   │   ─ Each runs start-feature                                           │
   │   ─ Reads brief + contract + persona + project AGENTS.md              │
   │   ─ Writes code in assigned lane                                      │
   │   ─ Runs finish-feature (self-review block, lane check, rebase)       │
   │                       │                                               │
   │                       ▼                                               │
   │   Lead — PR review gate                                               │
   │   ─ Verifies self-review, lane discipline, testable check             │
   │   ─ Approves or requests changes                                      │
   │   ─ Merges in dependency order                                        │
   │   ─ Closes issues                                                     │
   │                                                                      │
   └──────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1 — Lead intake

**Trigger:** issue moves into Agent Work status (or is manually claimed by Lead).

**Inputs:** issue body (title, description, acceptance criteria).

**Decisions Lead makes:**

1. *Is the brief implementable as written?*
   - Acceptance criteria present and testable? If not — return to backlog with comment.
2. *Does it need design?*
   - Touches REST API, DB schema, event payload, IaC output, or any other
     contract that other lanes will consume? If yes — branch to Architect.
3. *Does it decompose across lanes?*
   - Multiple lanes touched? If yes — split into per-lane sub-issues, each with
     its own brief, all linking to the parent.
4. *Which roles are assigned?*
   - Map sub-issues to roles defined in project's `AGENTS.md`.

**Outputs:**
- Agent Brief written into each (sub-)issue body in the construct's brief
  format ([`brief-format.md`](brief-format.md)); the brief SHOULD carry an
  `estimate:` size class for calibration against recorded actuals.
- Sub-issues created and linked.
- Issue assignments set.

**Hand-off conditions:**
- To Architect: brief flagged "needs design", contract not yet in main.
- To Implementer: brief approved, contract in main (if applicable), role assigned.

---

## Stage 2 — Architect design (conditional)

**Trigger:** Lead's brief has "needs design" flag.

**Inputs:** brief, related ADRs, current architecture.md, current contracts.

**Activities:**
1. Author contract file in `docs/contracts/<feature>.*`.
2. Author ADR draft if a non-obvious trade-off is being made.
3. Open contract PR.
4. Refinement loop with Lead — iterate until signed off.

**Hard rules:**
- Contract PR MUST merge to `main` before stage 3 starts for this feature.
- Architect does not write application code.
- Architect's lanes are limited to `docs/architecture/`, `docs/adr/`,
  `docs/contracts/` (project may widen).

**Outputs:**
- Contract file in `main`.
- ADR in `main` (if applicable).
- Refined acceptance criteria pushed back to issue brief.

---

## Stage 3 — Implementer build (parallel)

**Trigger:** brief approved + (if applicable) contract in `main` + role assigned.

**Pre-conditions checked by `pre-implement` hook:**
- Branch exists and is from the project default branch.
- Brief is non-empty.
- If brief references a contract path, that file exists in `main`.
- Role is defined in `AGENTS.md` and resolves to the implementer persona.

**Activities:**
1. `start-feature <issue>` — creates branch, assigns issue, moves to Agent Work.
2. Read brief + contract + persona + AGENTS.md.
3. Write code only in assigned write lane.
4. Write tests for the testable check.
5. Self-review per format.
6. `finish-feature` — runs `pre-pr` hook, opens PR, moves issue to PR Review.

**Parallel execution:**
- Multiple Implementers may run stage 3 simultaneously **if** their roles have
  non-overlapping write lanes AND share the same locked contract.
- Lead is responsible for ensuring decomposition meets both conditions.

**Outputs:**
- Feature branch with code + tests.
- PR with self-review.
- Issue in PR Review status.

---

## Stage 4 — Lead review and merge

**Trigger:** PR opened with self-review.

**Activities:**
1. Verify `## Agent self-review — <role>` block is present and substantive.
2. Verify files changed match the role's write lane (`branch-guard` already
   enforces this on commit, but Lead double-checks at the PR level).
3. Verify testable check is met (run it if non-trivial).
4. Approve or request changes.
5. Merge in dependency order (e.g. schema PR before backend PR before frontend PR).
6. Close issue.

**Outputs:**
- PR merged.
- Issue closed.
- Milestone progress updated.

---

## Plan-mode policy per stage

The construct declares plan-mode behaviour at the persona level (frontmatter
`default_mode` and `plan_mode_triggers`). Summarised by workflow stage:

| Stage | Persona | Default mode | Switch-to-plan triggers |
|---|---|---|---|
| 1. Intake | Lead | execute | decomposing multi-lane feature; drafting ADR |
| 2. Design | Architect | plan | (always plan) |
| 3. Build | Implementer | execute | missing/ambiguous brief; missing contract; lane crossing; scope expansion |
| 4. Review | Lead | execute | reviewing cross-lane or contract-changing PR; resolving halts |

A host that supports plan mode (e.g. Claude Code's plan-mode toggle) SHOULD
auto-engage it when entering a stage whose persona's `default_mode` is `plan`,
and SHOULD switch back to plan mode mid-session when any of the persona's
`plan_mode_triggers` are observed. The triggers list is part of the persona
contract — see [`personas/`](../personas/).

## Re-entry conditions

Workflow re-enters earlier stages in these cases:

| Condition | Returns to | Why |
|---|---|---|
| Implementer finds contract is wrong | Architect | contract update is design work |
| Lead requests changes on PR | Implementer | normal review feedback |
| Architect cannot finalise without product input | Lead | escalation |
| Brief turns out to be ambiguous mid-implementation | Lead | re-write brief, do not guess |

In all cases, the work in progress is paused on the issue with a clear comment;
no silent continuation under uncertain conditions.
