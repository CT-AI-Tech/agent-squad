# SESSION_HANDOFF — agent-squad v0.1.0 (Cowork → Claude Code)

Snapshot of what was built and decided in the Cowork session that
bootstrapped this repo. Read this once when picking up the work in Claude
Code, then this file becomes historical context.

---

## Where things stand

**Git state:**
- v0.1.0 *skeleton* commit was pushed to `main` earlier in the session
  (https://github.com/aditya-kanekar-ct/agent-squad).
- Everything since then (the actual hook implementations, validators, tests,
  CI hardening, plan-mode triggers in personas, tool-hooks contract doc) is
  **uncommitted** in the working tree.
- Local CI dry-run is green: 31/31 smoke tests pass.

**Recommended next git commands** (run on Windows):

```bash
cd /c/Users/ADMIN/Documents/Project/agent-squad

# Verify locally first
npm install
bash tests/ci-dry-run.sh

# Commit and push
git add .
git commit -m "v0.1.0 complete: implement hooks, validators, tests, CI

- branch-guard + rebase-guard (construct tool hooks)
- check-brief-and-contract + validate-self-review + move-to-pr-review
  (skill lifecycle hooks)
- bin/validate-frontmatter + bin/validate-role-schema (CI validators)
- tests/run.sh (31 smoke tests), tests/ci-dry-run.sh
- plugin-ci.yml hardened to fail-on-error
- New contract doc: contract/tool-hooks.md (session.yml marker schema)
- Richer self-review format aligned with board-manager prior art
- Plan-mode triggers in persona frontmatter (default_mode, plan_mode_triggers)
- Collapsed migration to 2-phase: board-manager v0.4 will hard-dep here"

git push origin main
git tag -a v0.1.0 -m "v0.1.0: contract complete, enforcement active"
git push origin v0.1.0
```

---

## Architectural decisions made this session

These are the decisions I'd push back on changing without a clear reason:

1. **Three personas, not five.** Backend / Frontend / DB / Infra collapse to
   `implementer` + skill bundle + lane. DevOps is `architect` (for design
   work, e.g. cloud topology) or `implementer` (for execution, e.g.
   Dockerfile/CDK). Drove a real simplification of the role surface.

2. **Lead, Architect, Implementer as the persona axis.** Behaviour, not
   knowledge — i.e. how the agent acts, not what it knows. Knowledge =
   skills.

3. **Contract-first as a construct rule** (`contract/governance.md` #8–#10),
   not a per-project convention. Architect MUST land contract in `main`
   before any Implementer touches code that depends on it.

4. **Migration to ai-dlc-board-manager collapsed from 3-phase to 2-phase.**
   Agent-squad ships standalone-complete. Board-manager v0.4 will simply
   drop its duplicate hooks and hard-dep on agent-squad >= 0.1.

5. **`.agent-squad/session.yml` is the runtime source of truth** for the
   active role. The pre-implement hook resolves role → persona, skills,
   lanes from `AGENTS.md` and writes the snapshot. Downstream hooks
   (`branch-guard`, `validate-self-review`, `move-to-pr-review`) read the
   marker, never re-parse `AGENTS.md`. Cleaner than having every hook
   re-resolve.

6. **Plan-mode policy declared in persona frontmatter.** `default_mode`
   (plan|execute) and `plan_mode_triggers` (list of mid-session conditions).
   Architect defaults to plan. Lead and Implementer default to execute with
   explicit triggers (missing brief, missing contract, lane crossing, scope
   expansion).

7. **Self-review format upgraded** to match the proven board-manager v0.3
   format: `## Agent Brief` (paste testable check), then per-persona
   sections with concrete validation rules. Placeholder strings (e.g.
   `<paste here>`) are rejected.

8. **Tool hooks vs lifecycle hooks distinguished.** `contract/tool-hooks.md`
   (Claude Code-specific PreToolUse) vs `contract/lifecycle-hooks.md`
   (host-agnostic workflow stages). Both categories may enforce the same
   concern (e.g. lane discipline) — redundancy is intentional because
   different hosts give different guarantees.

---

## What v0.1.0 ships

Listed in [`CHANGELOG.md`](CHANGELOG.md) under `[0.1.0]`. Highlights:

- 3 personas (`personas/lead.md`, `architect.md`, `implementer.md`)
- 7 contract docs (`contract/*.md`)
- 5 working hooks (2 construct, 3 skill)
- 2 CLI validators
- 31 smoke tests
- Local CI dry-run (`tests/ci-dry-run.sh`)
- GitHub Actions workflow that fails on errors

---

## Open roadmap (in order of preference for "what next")

### Option A: Build the AWS Architect skill

The first domain skill, paired with the Architect persona. Validates the
contract against a real consumer whose outputs are non-code (ADRs, diagrams,
service-selection trade-offs) — the harder case. Will surface any
implementer-shaped assumptions baked into the construct.

Location: `skills/domain/aws/`.
Affinity: `[both]` (architect + implementer modes).
Architect mode content: service selection, capacity model, IAM design, cost
trade-offs.
Implementer mode content: boto3 patterns, async wrappers, retry, error
mapping.

### Option B: Run the todo-app validation experiment

A small CRUD todo app to stress-test the construct end-to-end. Now that
hooks actually enforce (rather than suggest), the validation will be real.

Proposed shape (from earlier in this session, not yet locked):
- Stack: Python + FastAPI backend, SQLite, React frontend (or Angular if you
  want to exercise the Angular skill specifically — that exists as a
  placeholder in `examples/AGENTS.md.example` but no `skills/domain/angular`
  has been built yet).
- Lead = you. Architect + Implementer = me.
- Briefs as markdown files (`briefs/<N>.md`), no board-manager integration
  yet.
- Goal: find contract holes that theory hid.

### Option C: ai-dlc-board-manager v0.4 migration

Drop duplicate hooks + skills, hard-dep on agent-squad >= 0.1.0. Mechanical
work; we have a clean target.

---

## Known issues from this session (FYI)

- **Write tool truncation on the Windows mount.** Writing files via the
  Write tool sometimes truncated at non-ASCII characters (em-dash, arrow).
  Workaround: bash heredoc. Files affected and recovered:
  `bin/validate-frontmatter.js` (twice), `validate-self-review.js`.
  Already documented in `CLAUDE.md` under "Stuck on the Windows file
  mount?". Continues to be the recommended pattern for hook scripts going
  forward.
- **`/tmp` on the Linux sandbox is on a different device than the Windows
  mount.** `mv /tmp/x /windows-mount/x` fails with "Operation not
  permitted". Use `cat /tmp/x > /windows-mount/x` instead.
- **Git operations on the Windows mount from the Linux sandbox don't
  work.** Lock files can't be unlinked. All git operations were performed
  by the user on the Windows machine directly — this is the
  recommended/only path. Plan for any future sessions: I propose changes,
  the user runs git.

---

## What's NOT in v0.1.0 (deliberate)

- No domain skills yet (AWS / Python / React / DICOM all empty in
  `skills/domain/`).
- No `start-feature` skill — that's board-manager's job.
- No board integration in `move-to-pr-review` beyond a `NEXT_STEP` line on
  stdout; the calling skill (board-manager's `finish-feature`) is expected
  to act on it.
- No reverse sync from `.agent-squad/session.yml` back to `AGENTS.md` — the
  marker is a one-way resolution snapshot.

---

## How to pick up in Claude Code

```bash
cd /c/Users/ADMIN/Documents/Project/agent-squad
claude
```

Claude Code auto-loads `CLAUDE.md` from cwd. Optionally also point it at this
file for full session context: in the session, ask Claude Code to read
`SESSION_HANDOFF.md` first.
