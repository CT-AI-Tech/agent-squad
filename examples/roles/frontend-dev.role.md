# Role template — frontend-dev

Copy the yaml entry below into the `roles:` list inside your project's
`AGENTS.md`. Frontend implementation lane for React + TypeScript. The
Implementer consumes a locked API contract from `docs/contracts/` to
know which endpoints exist and their shapes.

```yaml
- name: frontend-dev
  persona: implementer
  skills: [react, typescript]
  lanes:
    write:
      - frontend/
      - public/
    read:
      - docs/contracts/
      - docs/architecture/
```

## When to use this role

Browser-side feature work in a React + TypeScript app. The role assumes
a `frontend/` subdirectory layout — adjust paths if your project uses a
different shape (e.g. monorepo `apps/web/`).

## What it does

- Reads the brief and the API contract
- Writes components, pages, hooks, and tests inside `frontend/`
- Stays inside the write lane — does not touch `app/api/`
  (`backend-dev`'s lane) or `cdk/` (`devops-engineer`'s lane)
- Self-reviews before invoking `finish-feature`

## Common variations

- **Next.js**: as written; the `frontend/` lane covers app-router or
  pages-router layouts. Consider adding a `nextjs` skill (not yet
  shipped) if framework-specific patterns warrant separate documentation.
- **Vite SPA**: as written
- **Angular**: swap `react` for `angular`. `angular` skill not yet
  shipped — would need to be added under `skills/domain/angular/`.
- **Component-library work**: narrow the write lane to
  `frontend/components/` to keep page-routing changes out of scope.

## Skills implied

- `react` — component composition, hooks, suspense, accessibility
- `typescript` — typing conventions, discriminated unions, generic patterns
- (Styling skills — `tailwind`, `css-modules`, etc. — not yet shipped)
