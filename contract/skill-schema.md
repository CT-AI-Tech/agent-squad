# Skill file schema

Every `SKILL.md` under `skills/` MUST start with YAML frontmatter conforming to
this schema. Fields marked **required** are part of the public contract.

## Frontmatter schema

```yaml
---
name: <kebab-case>                       # required, MUST match parent directory name
version: <semver>                        # required, version of the skill
construct_version: <semver-range>        # required, min agent-squad version (e.g. ">=0.1.0")
description: <one-line string>           # required, used for auto-trigger matching
persona_affinity:                        # required, which persona(s) this skill decorates
  - implementer | architect | lead | both
domain: <kebab-case>                     # required, e.g. aws, python, dicom; "core" for construct skills
owner: <team or handle>                  # required
requires_skills: [<skill-name>, ...]     # optional, hard skill dependencies
suggests_skills: [<skill-name>, ...]     # optional, soft pairing
hooks:                                   # optional, lifecycle hooks this skill registers
  pre-implement:  <path-to-handler>
  post-implement: <path-to-handler>
  pre-pr:         <path-to-handler>
  post-pr:        <path-to-handler>
---
```

## Field rules

- `persona_affinity` is the most important field. It tells the role validator
  whether this skill is legal for a given role. `both` means the skill has
  separate guidance for architect-mode and implementer-mode, and the body MUST
  contain sections `## Architect mode` and `## Implementer mode`.
- `domain: core` is reserved for construct-owned skills under `skills/core/`.
  All other skills live under `skills/domain/`.
- `construct_version` MUST use a semver range. Bare `0.1.0` means exactly that
  version; `>=0.1.0` means anything compatible at major 0.
- `description` is matched against issue text and brief content for auto-trigger.
  Be specific — generic descriptions cause wrong-skill triggering.
- `requires_skills` is enforced by the role validator: a role using skill A with
  `requires: [B]` MUST also include skill B.

## Body sections (convention)

```
## Description
## When this skill applies
## Architect mode (only if persona_affinity includes architect or both)
## Implementer mode (only if persona_affinity includes implementer or both)
## References
```

For domain skills, factual knowledge (patterns, gotchas, anti-patterns) lives in
the body. The frontmatter is purely metadata.

## Validation

CI runs:

1. Frontmatter parses as valid YAML.
2. All required fields present.
3. `persona_affinity` values are in the allowed set.
4. If `affinity: both`, body contains both mode sections.
5. `construct_version` is a valid semver range.
6. `name` matches parent directory name.

## Example skeleton

```markdown
---
name: aws
version: 0.1.0
construct_version: ">=0.1.0"
description: AWS service selection, IAM patterns, and infra trade-offs for cloud workloads.
persona_affinity: [both]
domain: aws
owner: cloud-platform-team
suggests_skills: [terraform, aws-cdk]
---

## Description
...

## Architect mode
Service selection, capacity, IAM design, cost trade-offs.

## Implementer mode
boto3 patterns, async wrappers, retry, error mapping.

## References
- AWS Well-Architected pillars: ...
```
