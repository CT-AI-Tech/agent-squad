# Role template — cloud-architect

Copy the yaml entry below into the `roles:` list inside your project's
`AGENTS.md`. The Architect designs before the Implementer builds; the
contract Architect lands in `main` is what gates Implementer work
(see `contract/governance.md` rule 8).

```yaml
- name: cloud-architect
  persona: architect
  skills: [aws]
  lanes:
    write:
      - docs/architecture/cloud/
      - docs/adr/
      - docs/contracts/cloud-*.md
      - docs/contracts/cloud-*.yaml
    read:
      - docs/contracts/
      - infra/
```

## When to use this role

Any project that runs on a public cloud and has non-trivial topology
decisions to make: VPC layout, IAM design, capacity model, multi-region
strategy, cost-shape trade-offs.

## What it does

- Drafts cloud contracts in `docs/contracts/cloud-*.{md,yaml}` (request
  shape, capacity envelope, IAM expectations)
- Authors ADRs explaining service-selection and topology decisions
- Refines proposals iteratively with Lead until sign-off
- Does **not** implement — the matching Implementer role (e.g.
  `devops-engineer`) consumes the contract

## Common variations

- **AWS-only projects**: as written above
- **Multi-cloud projects**: split into `aws-architect`, `gcp-architect`,
  etc. Each gets its own provider-specific contract path
  (`docs/contracts/aws-*.yaml`, `docs/contracts/gcp-*.yaml`)
- **GCP / Azure**: swap the `aws` skill for `gcp` or `azure` (stubs not yet
  shipped — `aws` is the only cloud skill v0.2 provides)

## Skills implied

- `aws` — service-selection trade-offs, IAM design, capacity modelling,
  cost-shape heuristics. Currently a stub; real content in v0.3.
