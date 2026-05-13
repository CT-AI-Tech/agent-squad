# Role template — devops-engineer

Copy the yaml entry below into the `roles:` list inside your project's
`AGENTS.md`. Infrastructure-as-code and CI/CD implementation lane. The
Implementer consumes cloud contracts from `docs/contracts/cloud-*.yaml`
authored by the `cloud-architect` role.

```yaml
- name: devops-engineer
  persona: implementer
  skills: [docker, terraform, github-actions]
  lanes:
    write:
      - Dockerfile*
      - docker-compose*
      - infra/
      - terraform/
      - .github/workflows/
      - .env.example
    read:
      - docs/architecture/cloud/
      - docs/contracts/
```

## When to use this role

Any IaC, container-image, or CI/CD work. The role's lane is wider than
most because DevOps spans several conventional directories.

## What it does

- Reads cloud contracts and architecture docs
- Writes Terraform modules, Dockerfiles, compose files, and GitHub Actions
  workflows
- Stays inside the write lane — does not touch application code
  (`backend-dev` / `frontend-dev`'s lanes)
- Self-reviews before invoking `finish-feature`

## Common variations

- **AWS CDK projects**: swap `terraform` skill for `aws-cdk` (stub not
  yet shipped). Lane path changes from `terraform/` to `cdk/`.
- **GitLab CI / CircleCI**: swap `github-actions` for the equivalent
  skill (neither shipped yet). Lane path changes from
  `.github/workflows/` to `.gitlab-ci.yml` / `.circleci/`.
- **Kubernetes-heavy projects**: consider adding `kubernetes` skill (not
  yet shipped) and widening the lane to include `k8s/` or `manifests/`.
- **Multi-cloud / hybrid**: split into `aws-devops`, `gcp-devops` so each
  role's lane is provider-scoped.

## Skills implied

- `docker` — multi-stage builds, image-size discipline
- `terraform` — module structure, state-backend discipline
- `github-actions` — workflow composition, secrets/OIDC, matrix builds

## Note on `hooks_overrides`

DevOps engineers occasionally need to commit through CDK-regenerated
files or large Terraform-formatted diffs. If `rebase-guard` proves too
strict in practice, this role is the canonical candidate for a
`hooks_overrides.rebase-guard: warn` override — see
`contract/role-schema.md` on `hooks_overrides`.
