# Role template — lead

Copy the yaml entry below into the `roles:` list inside your project's
`AGENTS.md`. Every project's `AGENTS.md` MUST contain at least one role
with `persona: lead` — this is the canonical one.

```yaml
- name: lead
  persona: lead
  skills: []
  lanes:
    write: [docs/adr/, AGENTS.md, .ai-dlc.yml, ProjectPlan.md]
    read:  []   # default = everything readable
```

## When to use this role

Always. Every adopting project starts here. The Lead role is the only
construct-mandated role.

## What it does

- Reads incoming issues and decides whether they need design (Architect
  involvement) before implementation
- Authors briefs in `briefs/<issue>.md` with a Testable Check the
  Implementer must verify
- Decomposes work across roles and assigns lanes
- Reviews PRs against the self-review block, merges in dependency order
- Owns ADRs and governance documents

## Common variations

- **Multi-lead projects**: legal-mandated separation of duties may require
  two leads with distinct `name` values (`lead-frontend`, `lead-backend`)
  but both `persona: lead`. The construct allows this; lane overlap is
  expected.
- **No-ADR projects**: drop `docs/adr/` from `lanes.write` if your project
  doesn't use ADRs. The construct documents but does not require ADRs.

## Skills implied

None. Lead is a behaviour-only persona — orchestration and judgement, not
domain knowledge. If a Lead needs domain depth, that depth lives in the
Architect or Implementer they delegate to.
