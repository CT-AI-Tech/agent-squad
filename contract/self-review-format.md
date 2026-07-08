# Self-review format

Every PR opened via `finish-feature` MUST contain the persona-appropriate
self-review block. Section names are contract — `validate-self-review` (the
`pre-pr` hook in `finish-feature`) rejects PRs missing required sections or
filled with placeholder content.

The format generalises the Agent self-review pattern from the AI-DLC line.
The "Codex" label is retired in favour of "Agent self-review" — the verbatim
section name is now `Agent self-review — <role-name>`.

The intent of the self-review is not "an independent review" — that is the
human reviewer's job. Its purpose is:

1. Leave a written trace of what the agent actively checked, so the reviewer
   knows what was already verified and what wasn't.
2. Force the agent to re-read its own diff before submitting.

Because the self-review is written by the author, **rubber-stamping is not
allowed**. The format enumerates concrete sections so vague "No issues found"
responses cannot pass validation.

---

## Implementer

Required block in the PR body:

```
## Agent Brief
<paste the full Testable Check from the issue, verbatim>

## Agent self-review — <role-name>

### What I actively checked (required, list at least 3 items)
- <e.g. "Re-read app/api/stow.py end-to-end against the brief">
- <e.g. "Confirmed multer-multipart-related is the dependency used, not upstream multer">
- <e.g. "Walked the diff once more for stray console.log / debug statements">

### Testable Check verification (required)
Command run:    <exact command from the Testable Check>
Output (verbatim, abbreviated only with [...] for length):
    <paste output here>
Result:         passed | failed | partial — <one-line explanation>

### How to test (required)
<reviewer-facing reproduction steps: commands to run, URLs to open, what
to expect. At least 2 steps or 1 command line.>
1. <e.g. "docker compose up api">
2. <e.g. "curl -X POST localhost:8000/studies -F file=@fixtures/ct.dcm — expect 200 with study UID">

### Files changed (required)
- <file path>: <one-line description of what changed>
- ...

### Tests written or updated (required if the change has logic)
<list test file paths and the cases each covers; or state
"No tests added because <reason>" — be specific (e.g. "pure rename")>

### Issues I found and chose not to fix in this PR (required header, list zero or more)
- ⚠ <file>:<line> — <description> — <why deferred + tracking link or "not yet tracked">

### Concerns for the human reviewer (optional)
<anything you want the reviewer to look at first>
```

### Validation by `validate-self-review`

The `pre-pr` hook in `finish-feature` rejects the PR if any of these are true:

| Check | What it looks for |
|---|---|
| Header `## Agent self-review — <role>` is present | Literal match; `<role>` substituted from the active-role marker |
| `## Agent Brief` section is present and non-empty | The Testable Check must be pasted, not summarised |
| `### What I actively checked` contains at least 3 list items | Bullet count ≥ 3 |
| `### Testable Check verification` contains `Command run:`, `Output`, and `Result:` lines | All three sub-fields present |
| `### How to test` has reproduction steps | At least 2 list/numbered steps, or at least 1 command line (fenced block or `$ `-prefixed) |
| `### Files changed` list matches `git diff --name-only` | Every file in the diff appears; no extra files |
| `### Tests written or updated` is non-empty | Either lists test files or explains absence |
| `### Issues I found and chose not to fix` header is present | Section header MUST appear even if list is empty |
| No placeholder strings remain | Literal `<...>` and `<paste output here>` cause rejection |
| Block is not pure boilerplate | Required sections must contain content beyond the templated headings |

Rejection prints a structured error pointing at which check failed and on
which line.

---

## Architect

Required block in the PR body of any contract or ADR PR:

```
## Agent self-review — <role-name>

### Trade-offs considered (required, list at least one)
- <choice>: <chosen option> over <alternative> because <reason>

### Alternatives explicitly rejected (required, list at least one)
- <alternative>: <reason for rejection>

### Downstream impact (required)
- <consumer lane>: <what this constrains for them>

### Open questions for Lead (required header)
- <question> [or write "None" — header must remain]
```

### Validation by `validate-self-review`

| Check | What it looks for |
|---|---|
| Header `## Agent self-review — <role>` is present | Literal match |
| `### Trade-offs considered` has ≥ 1 list item | Non-empty list |
| `### Alternatives explicitly rejected` has ≥ 1 list item | Non-empty list |
| `### Downstream impact` is non-empty | At least one bullet |
| `### Open questions for Lead` header is present | Even if list is "None" |
| No placeholder strings remain | Same as implementer rule |

If a design PR genuinely has no trade-offs worth recording, it probably
shouldn't be a design PR — re-classify it before submitting.

---

## Lead

Required block in the PR body of any ADR or governance PR Lead authors:

```
## Agent self-review — lead

Decision:           <one-line summary of what this ADR/change locks in>
Inputs considered:  <list of issues, prior ADRs, or stakeholder asks>
Affected roles:     <list of roles whose lanes or workflow this changes>
Migration:          none | <how downstream roles adapt>
Reversibility:      reversible | one-way | conditionally reversible
```

Lead does not need to fill this for routine triage — only for ADRs and changes
to `AGENTS.md`, `.ai-dlc.yml`, or other governance files.

### Validation by `validate-self-review`

| Check | What it looks for |
|---|---|
| Header `## Agent self-review — lead` is present | Literal match |
| All five fields present and non-empty | Each field after `:` has content |
| No placeholder strings remain | Same rule |

---

## Validation summary

| Section | Required for | Validator check |
|---|---|---|
| `## Agent Brief` | implementer | non-empty; testable check pasted |
| `## Agent self-review — <role>` header | all | exact string, role from active-role marker |
| `### What I actively checked` | implementer | ≥ 3 bullets |
| `### Testable Check verification` | implementer | command + output + result sub-fields |
| `### How to test` | implementer | ≥ 2 steps or ≥ 1 command line |
| `### Files changed` | implementer | matches `git diff --name-only` |
| `### Tests written or updated` | implementer | non-empty |
| `### Issues I found and chose not to fix` | implementer | header present |
| `### Trade-offs considered` | architect | ≥ 1 bullet |
| `### Alternatives explicitly rejected` | architect | ≥ 1 bullet |
| `### Downstream impact` | architect | non-empty |
| `### Open questions for Lead` | architect | header present |
| `Decision:` | lead | non-empty |
| `Inputs considered:` | lead | non-empty |
| `Affected roles:` | lead | non-empty |
| `Migration:` | lead | non-empty |
| `Reversibility:` | lead | one of: reversible, one-way, conditionally reversible |
