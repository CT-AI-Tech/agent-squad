# Agent Brief format

The Agent Brief is the Lead's hand-off artifact to an Implementer (or
Architect). This file formalizes the brief schema that
`skills/implement/hooks/check-brief-and-contract.js` has enforced de facto
since v0.1. The schema is part of the public contract as of v0.4.

## Location (search order)

The `pre-implement` hook locates the brief for issue `<N>` in this order:

1. `.agent-squad/brief.md` (session-local, takes priority)
2. `briefs/<N>.md`
3. `briefs/<N>-*.md` (first match by directory order)

## Frontmatter

```yaml
---
issue: 42                          # optional, informational
role: backend-dev                  # optional, informational
contract: docs/contracts/api-x.md  # optional; when present the file MUST
                                   #   exist in the default branch before
                                   #   implementation starts (contract-first)
estimate: M                        # optional; S | M | L | XL (case-insensitive
                                   #   input, stored uppercase)
---
```

| Field | Required | Enforced by pre-implement hook |
|---|---|---|
| `issue` | no | not validated |
| `role` | no | not validated (role comes from the hook payload) |
| `contract` | no | blocks if the path is absent from the default branch |
| `estimate` | no | blocks if present but not one of `S`, `M`, `L`, `XL` |

## Body

The brief body MUST contain a non-empty `## Testable Check` section — the
concrete command or observable behaviour that proves the feature works. A
brief without one is not implementable and the `pre-implement` hook blocks.

Other body sections (`## Context`, `## Acceptance criteria`, design notes)
are recommended but not validated.

## Estimate calibration bands

`estimate` is a coarse size class, not a prediction. The bands below are
**calibration bands for comparison against recorded actuals** (see the usage
ledger in [`tool-hooks.md`](tool-hooks.md)) — not promises:

| Estimate | Rough total tokens (all sessions for the feature) |
|---|---|
| `S` | under ~50k |
| `M` | ~50k - 150k |
| `L` | ~150k - 400k |
| `XL` | over ~400k |

When the `pre-implement` hook accepts a brief with an `estimate`, it copies
the normalized value into the session marker (`.agent-squad/session.yml`,
field `estimate`). At PR time, `move-to-pr-review` emits a `USAGE_TOTAL`
line pairing the estimate with actual token usage from the ledger, so Lead
estimates improve with every shipped feature.

## Example

See [`examples/brief.md.example`](../examples/brief.md.example).
