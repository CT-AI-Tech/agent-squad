# Governance — non-negotiable rules

These rules apply to every persona, every skill, and every project that adopts
agent-squad. The set is part of the public contract. Adding a rule is a minor
contract bump if existing skills satisfy it; otherwise major. Removing a rule
is a major bump.

---

## Branch and commit rules

1. **No commits to `main` or `master`.** Always work on a feature branch.
2. **No force-push to shared branches.** `main`, `master`, release branches, and
   any branch with an open PR are off-limits to force-push.
3. **Rebase, don't merge, into your feature branch.** `rebase-guard` enforces this
   on commit.
4. **One feature, one branch.** Don't pile unrelated work onto the same branch
   "while I'm here".

## Lane discipline

5. **Stay within your assigned `write` lane.** `branch-guard` blocks edits to
   files outside the role's lane.
6. **Never overwrite another agent's files.** If your brief implies you must,
   halt and ask Lead to widen your lane or reassign.
7. **No lane crossing without Lead approval.** Adding lanes is a brief
   amendment, not an at-the-keyboard decision.

## Contract-first

8. **API and schema contracts go first.** Any feature with a contract surface
   (REST, schema, event, IaC output) requires the Architect's contract to land
   in `main` before any Implementer writes code against it.
9. **Don't invent fields not in the contract.** If the contract is wrong or
   incomplete, halt and flag — don't extend it silently.
10. **Don't break existing contracts without ADR.** Modifying a contract that
    has consumers is an architecture decision and requires Lead sign-off.

## Self-review

11. **Every PR has a self-review block.** Per
    [`self-review-format.md`](self-review-format.md). `finish-feature` blocks PRs
    without one.
12. **Self-review is substantive.** Boilerplate ("looks good", placeholder values
    not replaced) is treated as a missing review.
13. **Never approve your own PR.** Lead reviews Implementer PRs. Lead's own PRs
    require a different reviewer (human or Lead from another team).

## Issue and milestone hygiene

14. **Implementers do not close issues.** Lead closes after merge.
15. **No silent scope expansion.** If the issue's brief grew during work, edit
    the issue body and re-confirm with Lead before continuing.
16. **Stale work returns to backlog.** Per project's `stale_threshold_days`.

## Destructive operations

17. **No destructive DB ops without reversible migrations.** `DROP`, `TRUNCATE`,
    column removals require an `upgrade()` and a working `downgrade()`.
18. **No deletion of another agent's branches without owner consent.**

## Construct files

19. **Implementers and Architects do not modify `AGENTS.md`, `.ai-dlc.yml`, or
    files under `contract/`.** Those are Lead's lane.
20. **Skills do not patch the construct.** A skill MAY register hooks; it MUST
    NOT modify construct files at install or runtime.

## Sensitive data

21. **No secrets in repo.** Credentials, API keys, tokens go in environment
    config (`.env`, Vault, AWS Secrets Manager) — never in committed files.
22. **No PII in test fixtures.** Use synthetic data.

## Enforcement

| Rule | Enforced by |
|---|---|
| 1, 5, 6 | `branch-guard` hook |
| 3 | `rebase-guard` hook |
| 8, 9 | `pre-implement` hook in core (verifies contract path exists when brief flags it) |
| 11, 12 | `pre-pr` hook in `finish-feature` |
| 17 | `pre-pr` hook in `postgres` skill (for DB-touching PRs) |
| 21 | external secret-scanning CI (project-provided) |
| Others | review responsibility (Lead) |
