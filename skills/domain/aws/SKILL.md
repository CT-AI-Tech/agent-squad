---
name: aws
version: 0.1.0
construct_version: ">=0.1.0"
description: AWS knowledge for cloud architecture design and implementation. Stub — real content lands in a future release.
persona_affinity: [both]
domain: aws
owner: agent-squad-core
---

# AWS (stub)

This is a placeholder skill. It validates against the contract so role
templates that reference `aws` can be wired end-to-end, but the body
intentionally has minimal content. Real content is a v0.3 track per
`SESSION_HANDOFF.md` Option A.

The construct-vs-knowledge boundary for AWS sits roughly at:

- **Knowledge (belongs here, eventually):** service selection trade-offs,
  IAM design patterns, capacity modelling, cost-shape heuristics, boto3
  retry patterns, async wrappers, error mapping, region-failover patterns.
- **Construct (belongs in personas/lanes):** when an Architect drafts a
  cloud contract, when an Implementer touches `cdk/`, what the self-review
  block must contain.

## Architect mode

Service selection, capacity model, IAM design, cost trade-offs. ADRs land
in `docs/adr/`; cloud contracts in `docs/contracts/cloud-*.yaml`.

## Implementer mode

boto3 patterns, async wrappers, retry, error mapping. Code lands in the
role's write lane (typically `cdk/`, `infra/`, or `app/services/`).
