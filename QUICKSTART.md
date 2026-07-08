# QUICKSTART — Adopting agent-squad in a project

This guide walks you from zero to a working role-mapped project.

## 0. Install agent-squad's own dependencies (once)

The construct uses `js-yaml` in its validators and skill hooks. Install once
in the agent-squad directory:

```bash
cd /path/to/agent-squad
npm install
```

This creates `node_modules/` that the hook scripts and validators resolve at
runtime. Skip this step and the hooks will print a clear error telling you to
run it.

## 1. Install agent-squad as a plugin

Install `agent-squad` as a Claude Code plugin in your project repo:

```bash
# from the repo root of your project
claude plugin install agent-squad
```

This adds the construct's personas, core skills, hooks, and the role schema.

## 2. Create your project's AGENTS.md

**Recommended:** run the init skill from your project root and review the
draft it produces:

```bash
/agent-squad:init
```

It scans your plan docs and tech stack, composes roles from the template
library in [`examples/roles/`](examples/roles/), validates the result, and
scaffolds `.ai-dlc.yml`. The output is a draft — review every role, skill,
and lane before first use.

**Manual fallback:** copy [`examples/AGENTS.md.example`](examples/AGENTS.md.example)
to your repo root as `AGENTS.md`. This file is **project-owned** — it declares
the roles your team needs by composing personas + skills + lanes.

```yaml
roles:
  - name: backend-dev
    persona: implementer
    skills: [python, fastapi]
    lanes:
      write: [app/api/, app/services/, tests/]
      read:  [docs/contracts/, docs/architecture/]
```

See [`contract/role-schema.md`](contract/role-schema.md) for the full schema.

## 3. (Optional) Add `.ai-dlc.yml` for hooks

If you use the board manager or want hook control, copy
[`examples/.ai-dlc.yml.example`](examples/.ai-dlc.yml.example) and edit. Each
hook can be `enabled` (default), `warn`, or `disabled`.

## 3a. (Optional, recommended) Give the squad its own GitHub identity

By default `finish-feature` opens PRs with *your* `gh` login — and GitHub
won't let you formally review your own PRs (no approve, no request-changes,
no batched inline suggestions). Giving the squad a bot identity fixes that:
the bot opens the PR, you review it like any teammate's work.

You need **one** bot account for the whole squad — not one per persona.
Persona attribution lives in commit metadata; the bot only answers "who
opened the PR".

**Create the bot account and token (about 10 minutes, once):**

1. Sign up a new GitHub account for the bot, e.g. `yourorg-agent-bot`.
   GitHub's Terms of Service allow one free machine account per human user.
2. From your own account, invite the bot as a **collaborator with Write
   access** on the project repo (Settings > Collaborators). Accept the
   invite as the bot.
3. Logged in **as the bot**, create a fine-grained personal access token:
   Settings > Developer settings > Personal access tokens > Fine-grained
   tokens > Generate new token.
   - **Repository access:** only the project repo.
   - **Permissions:** Pull requests: Read and write. Contents: Read-only.
   - Set an expiry you can live with and note the renewal date.
4. Copy the token — you'll only see it once.

**Where to add the token** (pick one; never commit it to the repo):

- *User environment variable* — survives every session:

  ```powershell
  # PowerShell (Windows) - persists for your user account
  [Environment]::SetEnvironmentVariable('AGENT_SQUAD_GH_TOKEN', '<paste-token-here>', 'User')
  ```

  ```bash
  # bash/zsh - add to ~/.bashrc or ~/.zshrc
  export AGENT_SQUAD_GH_TOKEN='<paste-token-here>'
  ```

  Restart your terminal (and Claude Code) after setting it.

- *Claude Code local settings* — per-project, untracked by git:

  ```json
  // .claude/settings.local.json in your project repo
  {
    "env": {
      "AGENT_SQUAD_GH_TOKEN": "<paste-token-here>"
    }
  }
  ```

That's it. When the variable is set, `finish-feature` passes it as
`GH_TOKEN` to `gh pr create` only — commits and pushes still use your normal
credentials, so nothing else about your git setup changes. When it's unset,
PRs are opened with your own login as before.

**Worth doing at the same time:** turn on branch protection for `main`
requiring one approving review. The bot can't approve its own PRs, so the
rule now genuinely means a human (you) signed off.

## 4. Pick the skills your project needs

Skills live in `agent-squad/skills/domain/`. Reference them by name in your roles.
Skills declare which persona they decorate (`persona_affinity`) — if a skill is
implementer-only and you reference it from an architect role, the role validator
will warn you.

## 5. Run your first feature

If your project also uses `ai-dlc-board-manager`:

```bash
# Lead session
/ai-dlc-board-manager:start-feature 42

# Architect session (only if Lead's brief calls for design)
# Architect drafts contract to docs/contracts/<feature>.* — gets to main first

# Implementer sessions (parallel, one per lane)
/agent-squad:implement 42-backend
/agent-squad:implement 43-frontend

# Each Implementer wraps with:
/agent-squad:finish-feature
```

Without the board manager, the same skills work — you just create issues and
branches manually.

## 6. See who is active

Two mechanisms show which agent (persona + role) is currently working:

- **Automatic context injection** — the `session-context` hook reads
  `.agent-squad/session.yml` on every prompt and tells the model which persona
  it is, so the agent announces itself at turn start. No setup needed; disable
  via `session_context: disabled` in `.ai-dlc.yml`.
- **Statusline** — add to your project's `.claude/settings.json` (the init
  skill offers to do this for you):

  ```json
  {
    "statusLine": {
      "type": "command",
      "command": "node <plugin-root>/bin/squad-status.js"
    }
  }
  ```

  Renders `[agent-squad] implementer:backend-dev #42 (sonnet)` while a session
  marker exists, and stays empty otherwise.

Lead and Architect sessions write the marker with
`node <plugin-root>/bin/squad-session.js set <role> [--issue N]` and clear it
with `... clear` on hand-off (Implementer sessions get it automatically from
the `pre-implement` hook).

## 7. Read the contract

Before writing your own skill or persona override, read [CONTRACT.md](CONTRACT.md)
and [`contract/`](contract/). The contract surface is small on purpose; everything
else is internal and may move.

## Verifying agent-squad itself

Before pushing changes to agent-squad, run the local CI dry-run from its
repo. The suite is Node — the same command works in PowerShell, bash, cmd,
or any shell with `node` on PATH:

```
cd /path/to/agent-squad
node tests/ci-dry-run.js
```

(`tests/ci-dry-run.ps1` and `tests/ci-dry-run.sh` are thin wrappers around
the same script, kept for muscle memory.)

This runs the same checks the GitHub workflow runs — manifest validity, hook
syntax, persona and skill frontmatter, the example AGENTS.md role schema, and
the full smoke-test suite across all hooks and validators.

Everything that runs at plugin runtime (hooks, `bin/` tools, validators) is
plain Node with no shell dependency — agent-squad needs no per-OS setup on
Windows, macOS, or Linux.

## Troubleshooting

- *Lane validation fails on edit* — `branch-guard` blocks edits to files
  outside the active role's `write` lane (read from `.agent-squad/session.yml`).
  If the violation is intentional, ask Lead to widen the lane in `AGENTS.md`.
  Don't disable the hook silently.
- *Hook errors with "js-yaml not found"* — run `npm install` in the agent-squad
  directory (see step 0).
- *Skill doesn't auto-trigger* — check `persona_affinity` in the skill's
  frontmatter matches your current role's persona.
- *Self-review block rejected on PR* — `finish-feature` invokes
  `validate-self-review` which enforces the per-persona format. Read the rejection
  message — it points at the failing section. See [`contract/self-review-format.md`](contract/self-review-format.md).
- *Can't approve or request changes on an agent PR* — the PR was opened with
  your own GitHub login, and GitHub blocks formal review on your own PRs. Set
  up the bot identity (`AGENT_SQUAD_GH_TOKEN`, step 3a) so `finish-feature`
  opens PRs as the bot. PRs opened before the change stay locked — close and
  re-open them as the bot if you need to review them formally.
- *Session marker not found* — the `pre-implement` hook
  (`check-brief-and-contract`) writes `.agent-squad/session.yml` after validating
  the brief. If the marker is missing, the brief is missing, has no testable
  check, or the role isn't in `AGENTS.md`. The hook output tells you which.
