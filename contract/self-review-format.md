# Self-review format

Every PR opened via `finish-feature` MUST contain the persona-appropriate
self-review block. Section names are contract — `finish-feature` rejects PRs
missing required sections.

The format generalises the Codex self-review pattern from the AI-DLC line. The
"Codex" label has been retired in favour of "Agent self-review" — the verbatim
section name is now `Agent self-review — <role-name>`.

---

## Implementer

Required block in the PR body:

```
## Agent self-review — <role-name>

✓ Testable check met: <how you verified it>
✓ Files changed stayed within lane: <list of files>
✓ Tests written/updated: <test files or "none required, justification">
✓ Contract honoured: <name of contract file consumed, or "no contract surface">

Issues found:
✗ <file>:<line> — <issue> [fixed | known gap]
⚠ <file>:<line> — <concern for reviewer>
```

If no issues: write `No issues found.` — never omit the section.

Aggregate patterns across files. If `async` is misused in 3 places, one entry
covers all 3.

`finish-feature` rejects the PR if any of these are present:

- The literal placeholder strings (`<how you verified it>`, etc.)
- An empty "Testable check met" line
- A "Files changed" list that doesn't match `git diff --name-only`
- The block missing entirely

---

## Architect

Required block in the PR body of any contract or ADR PR:

```
## Agent self-review — <role-name>

Trade-offs considered:
- <choice>: <chosen option> over <alternative> because <reason>

Alternatives explicitly rejected:
- <alternative>: <reason for rejection>

Downstream impact:
- <consumer lane>: <what this constrains for them>

Open questions for Lead:
- <question> [or "none"]
```

The "Trade-offs considered" section MUST list at least one entry — if a design
PR has no trade-offs worth recording, it probably shouldn't be a design PR.

---

## Lead

Required block in the PR body of any ADR or governance PR Lead authors:

```
## Agent self-review — lead

Decision: <one-line summary of what this ADR/change locks in>
Inputs considered: <list of issues, prior ADRs, or stakeholder asks>
Affected roles: <list of roles whose lanes or workflow this changes>
Migration: <none | how downstream roles adapt>
Reversibility: <reversible | one-way | conditionally reversible>
```

Lead does not need to fill this for routine triage — only for ADRs and changes
to `AGENTS.md`, `.ai-dlc.yml`, or other governance files.

---

## Validation rules summary

`finish-feature` validates:

| Section | Required | Validation |
|---|---|---|
| `## Agent self-review — <role>` header | always | exact string match, role from project AGENTS.md |
| `Testable check met` | implementer | non-empty, no placeholder |
| `Files changed stayed within lane` | implementer | matches `git diff --name-only` and role's `write` lane |
| `Tests written/updated` | implementer | non-empty |
| `Contract honoured` | implementer | non-empty, references contract file or justifies absence |
| `Issues found` | implementer | section present, even if `No issues found.` |
| `Trade-offs considered` | architect | non-empty list |
| `Decision` | lead | non-empty |
