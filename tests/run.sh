#!/usr/bin/env bash
# tests/run.sh — agent-squad smoke tests
# One pass per hook + per validator. Each test creates an isolated scratch
# repo under /tmp/agent-squad-test-$$, then cleans up. Failing tests print
# context. Final exit code is non-zero if any failed.
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="$(mktemp -d -t agent-squad-test-XXXXXX)"
PASS=0
FAIL=0
FAIL_NAMES=()

cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT

pass() { PASS=$((PASS+1)); echo "  [ok] $1"; }
fail() { FAIL=$((FAIL+1)); FAIL_NAMES+=("$1"); echo "  [FAIL] $1"; echo "$2" | sed 's/^/    /'; }

section() { echo ""; echo "═══ $1 ═══"; }

# Helper: run a hook script with stdin payload and capture exit + stdout
run_hook() {
  # $1 = script path
  # $2 = stdin JSON payload
  # output via: STDOUT, STDERR, EXIT global vars
  STDOUT=$(echo "$2" | node "$1" 2>"$SCRATCH/stderr")
  EXIT=$?
  STDERR=$(cat "$SCRATCH/stderr")
}

# ─── validate-frontmatter ───────────────────────────────────────────────
section "validate-frontmatter"

# Positive: real personas
node "$ROOT/bin/validate-frontmatter.js" "$ROOT/personas/lead.md" "$ROOT/personas/architect.md" "$ROOT/personas/implementer.md" >/dev/null 2>&1 \
  && pass "personas validate" || fail "personas validate" "non-zero exit"

# Positive: real skills
node "$ROOT/bin/validate-frontmatter.js" "$ROOT/skills/implement/SKILL.md" "$ROOT/skills/finish-feature/SKILL.md" >/dev/null 2>&1 \
  && pass "skills validate" || fail "skills validate" "non-zero exit"

# Positive: domain skill stubs (v0.2 starter set)
DOMAIN_STUBS="$ROOT/skills/domain/aws/SKILL.md $ROOT/skills/domain/python/SKILL.md $ROOT/skills/domain/fastapi/SKILL.md $ROOT/skills/domain/postgres/SKILL.md $ROOT/skills/domain/react/SKILL.md $ROOT/skills/domain/typescript/SKILL.md $ROOT/skills/domain/docker/SKILL.md $ROOT/skills/domain/terraform/SKILL.md $ROOT/skills/domain/github-actions/SKILL.md"
node "$ROOT/bin/validate-frontmatter.js" $DOMAIN_STUBS >/dev/null 2>&1 \
  && pass "domain skill stubs validate" || fail "domain skill stubs validate" "$(node "$ROOT/bin/validate-frontmatter.js" $DOMAIN_STUBS 2>&1)"

# Negative: missing fields
cat > "$SCRATCH/bad-persona.md" <<'P'
---
name: lead
version: 0.1.0
---
body
P
node "$ROOT/bin/validate-frontmatter.js" --kind persona "$SCRATCH/bad-persona.md" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "missing required field" "$SCRATCH/out" \
  && pass "rejects persona missing fields" || fail "rejects persona missing fields" "$(cat $SCRATCH/out)"

# Negative: bad persona name
cat > "$SCRATCH/bad-name.md" <<'P'
---
name: random-name
version: 0.1.0
construct_version: 0.1.0
description: x
owner: x
behavior:
  invoked_when: []
  outputs: []
  prohibited: []
default_mode: execute
plan_mode_triggers: []
self_review_format: x
---
body
P
node "$ROOT/bin/validate-frontmatter.js" --kind persona "$SCRATCH/bad-name.md" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "not in the v0.x persona set" "$SCRATCH/out" \
  && pass "rejects unknown persona name" || fail "rejects unknown persona name" "$(cat $SCRATCH/out)"

# ─── validate-role-schema ────────────────────────────────────────────────
section "validate-role-schema"

node "$ROOT/bin/validate-role-schema.js" "$ROOT/examples/AGENTS.md.example" >/dev/null 2>&1 \
  && pass "example AGENTS.md validates" || fail "example AGENTS.md validates" "non-zero exit"

# Negative: no lead role
cat > "$SCRATCH/no-lead.md" <<'A'
# x
```yaml
construct_version: ">=0.1.0"
roles:
  - name: backend
    persona: implementer
    skills: []
    lanes:
      write: [src/]
```
A
node "$ROOT/bin/validate-role-schema.js" "$SCRATCH/no-lead.md" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "lead" "$SCRATCH/out" \
  && pass "rejects roles with no lead" || fail "rejects roles with no lead" "$(cat $SCRATCH/out)"

# Negative: duplicate role names
cat > "$SCRATCH/dup.md" <<'A'
# x
```yaml
construct_version: ">=0.1.0"
roles:
  - name: lead
    persona: lead
    skills: []
    lanes: {write: []}
  - name: dev
    persona: implementer
    skills: []
    lanes: {write: [src/]}
  - name: dev
    persona: implementer
    skills: []
    lanes: {write: [src/]}
```
A
node "$ROOT/bin/validate-role-schema.js" "$SCRATCH/dup.md" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "more than once" "$SCRATCH/out" \
  && pass "rejects duplicate role names" || fail "rejects duplicate role names" "$(cat $SCRATCH/out)"

# ─── role templates (examples/roles/) ───────────────────────────────────
section "role templates"

# Each *.role.md is a single-role fragment. Wrap it in a synthetic AGENTS.md
# (with a stub lead if the fragment is not itself lead) and validate.
for f in "$ROOT/examples/roles/"*.role.md; do
  base=$(basename "$f" .role.md)
  # Extract the first ```yaml block, content only (without the fences).
  awk '/^```yaml$/{flag=1;next}/^```$/{if(flag){exit}}flag' "$f" > "$SCRATCH/fragment-$base.yml"
  if [ ! -s "$SCRATCH/fragment-$base.yml" ]; then
    fail "role template: $base extracts yaml" "yaml block empty or missing"
    continue
  fi
  out="$SCRATCH/role-test-$base.md"
  if grep -q "persona: lead" "$SCRATCH/fragment-$base.yml"; then
    # Lead fragment — wrap as-is
    {
      printf '%s\n' '# test'
      printf '```yaml\n'
      printf 'construct_version: ">=0.1.0"\n'
      printf 'roles:\n'
      sed 's/^/  /' "$SCRATCH/fragment-$base.yml"
      printf '```\n'
    } > "$out"
  else
    # Non-lead fragment — add a stub lead alongside
    {
      printf '%s\n' '# test'
      printf '```yaml\n'
      printf 'construct_version: ">=0.1.0"\n'
      printf 'roles:\n'
      printf '  - name: lead\n'
      printf '    persona: lead\n'
      printf '    skills: []\n'
      printf '    lanes:\n'
      printf '      write: []\n'
      sed 's/^/  /' "$SCRATCH/fragment-$base.yml"
      printf '```\n'
    } > "$out"
  fi
  if node "$ROOT/bin/validate-role-schema.js" "$out" >/dev/null 2>&1; then
    pass "role template: $base validates when composed"
  else
    fail "role template: $base validates when composed" "$(node "$ROOT/bin/validate-role-schema.js" "$out" 2>&1)"
  fi
done

# ─── branch-guard ────────────────────────────────────────────────────────
section "branch-guard"

# Setup a scratch git repo
mkdir -p "$SCRATCH/repo"
cd "$SCRATCH/repo"
git init -q -b main
git config user.email "test@test"
git config user.name "test"
echo "x" > x.txt; git add x.txt; git commit -q -m "init"
git checkout -q -b feature/42-test

# Test 1: not in repo (cwd = SCRATCH which has no .git)
cd "$SCRATCH"
echo '{"tool_input":{"file_path":"foo.py"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: passes outside git repo" || fail "branch-guard: passes outside git repo" "$(cat $SCRATCH/out)"

# Test 2: on main → block
cd "$SCRATCH/repo"
git checkout -q main
echo '{"tool_input":{"file_path":"x.txt"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 2 ] && grep -q "branch" "$SCRATCH/out" \
  && pass "branch-guard: blocks on main" || fail "branch-guard: blocks on main" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 2b: on main but file is outside the repo → allow (plan files, etc.)
echo "{\"tool_input\":{\"file_path\":\"$SCRATCH/outside-repo.md\"}}" | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: allows outside-repo path on main" || fail "branch-guard: allows outside-repo path on main" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 3: feature branch, no marker → allow
git checkout -q feature/42-test
echo '{"tool_input":{"file_path":"x.txt"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: allows on feature, no marker" || fail "branch-guard: allows on feature, no marker" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 4: marker with matching lane → allow
mkdir -p .agent-squad
cat > .agent-squad/session.yml <<'M'
construct_version: 0.1.0
role: backend-dev
persona: implementer
write_lanes:
  - app/
  - tests/
M
mkdir -p app
echo '{"tool_input":{"file_path":"app/foo.py"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: allows file in write lane" || fail "branch-guard: allows file in write lane" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 5: marker with non-matching lane → block
echo '{"tool_input":{"file_path":"frontend/page.tsx"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 2 ] && grep -q "outside the write lane" "$SCRATCH/out" \
  && pass "branch-guard: blocks file outside lane" || fail "branch-guard: blocks file outside lane" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 6: warn mode
cat > .ai-dlc.yml <<'C'
hooks:
  branch_guard: warn
C
echo '{"tool_input":{"file_path":"frontend/page.tsx"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: warn mode allows" || fail "branch-guard: warn mode allows" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 7: disabled mode (even on main)
cat > .ai-dlc.yml <<'C'
hooks:
  branch_guard: disabled
C
git checkout -q main
echo '{"tool_input":{"file_path":"x.txt"}}' | node "$ROOT/hooks/branch-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "branch-guard: disabled allows on main" || fail "branch-guard: disabled allows on main" "exit=$?  out=$(cat $SCRATCH/out)"

# ─── rebase-guard ───────────────────────────────────────────────────────
section "rebase-guard"

# Test 1: non-commit command → allow
echo '{"tool_input":{"command":"ls"}}' | node "$ROOT/hooks/rebase-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "rebase-guard: non-commit command passes" || fail "rebase-guard: non-commit command passes" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 2: bad JSON → allow (no crash)
echo 'not json' | node "$ROOT/hooks/rebase-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "rebase-guard: bad payload does not crash" || fail "rebase-guard: bad payload does not crash" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 3: warn mode on a commit command → allow with notice
cd "$SCRATCH/repo"
git checkout -q feature/42-test
cat > .ai-dlc.yml <<'C'
hooks:
  rebase_guard: warn
C
echo '{"tool_input":{"command":"git commit -m test"}}' | node "$ROOT/hooks/rebase-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "rebase-guard: warn mode allows commit" || fail "rebase-guard: warn mode allows commit" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 4: disabled
cat > .ai-dlc.yml <<'C'
hooks:
  rebase_guard: disabled
C
echo '{"tool_input":{"command":"git commit -m test"}}' | node "$ROOT/hooks/rebase-guard.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "rebase-guard: disabled allows" || fail "rebase-guard: disabled allows" "exit=$?  out=$(cat $SCRATCH/out)"

# ─── check-brief-and-contract ────────────────────────────────────────────
section "check-brief-and-contract"

mkdir -p "$SCRATCH/proj"
cd "$SCRATCH/proj"
git init -q -b main
git config user.email "test@test"
git config user.name "test"

# Minimal AGENTS.md
cat > AGENTS.md <<'A'
# project
```yaml
construct_version: ">=0.1.0"
roles:
  - name: lead
    persona: lead
    skills: []
    lanes:
      write: []
  - name: backend-dev
    persona: implementer
    skills: [python]
    lanes:
      write:
        - app/
        - tests/
      read:
        - docs/contracts/
```
A
git add AGENTS.md; git commit -q -m "init"

# Test 1: missing brief
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "no brief found" "$SCRATCH/out" \
  && pass "check-brief: rejects missing brief" || fail "check-brief: rejects missing brief" "$(cat $SCRATCH/out)"

# Test 2: brief without testable check
mkdir -p briefs
cat > briefs/42.md <<'B'
---
issue: 42
role: backend-dev
---

# Brief

Some description.
B
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "Testable Check" "$SCRATCH/out" \
  && pass "check-brief: rejects brief without testable check" || fail "check-brief: rejects brief without testable check" "$(cat $SCRATCH/out)"

# Test 3: valid brief, no contract — should pass and write session.yml
cat > briefs/42.md <<'B'
---
issue: 42
role: backend-dev
---

# Brief

Build CRUD endpoints.

## Testable Check

pytest tests/test_api.py
B
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && [ -f .agent-squad/session.yml ] && grep -q "role: backend-dev" .agent-squad/session.yml \
  && pass "check-brief: valid brief writes session marker" || fail "check-brief: valid brief writes session marker" "exit=$?  out=$(cat $SCRATCH/out)  marker=$([ -f .agent-squad/session.yml ] && cat .agent-squad/session.yml)"

# Test 4: brief with contract missing in main
cat > briefs/42.md <<'B'
---
issue: 42
role: backend-dev
contract: docs/contracts/api-todo.md
---

# Brief

Build CRUD endpoints per locked contract.

## Testable Check

pytest tests/test_api.py
B
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "contract" "$SCRATCH/out" \
  && pass "check-brief: rejects when contract not in main" || fail "check-brief: rejects when contract not in main" "$(cat $SCRATCH/out)"

# Test 5: brief with contract that IS in main
mkdir -p docs/contracts
echo "# API contract" > docs/contracts/api-todo.md
git add docs/contracts; git commit -q -m "contract"
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "check-brief: passes with contract in main" || fail "check-brief: passes with contract in main" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 6: role not in AGENTS.md
echo '{"event":"pre-implement","issue_number":42,"role":"nonexistent-role"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "not found" "$SCRATCH/out" \
  && pass "check-brief: rejects unknown role" || fail "check-brief: rejects unknown role" "$(cat $SCRATCH/out)"

# Test 7: role with wrong persona
cat > briefs/99.md <<'B'
---
issue: 99
role: lead
---

# Brief

## Testable Check

something
B
echo '{"event":"pre-implement","issue_number":99,"role":"lead"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "implementer" "$SCRATCH/out" \
  && pass "check-brief: rejects non-implementer persona" || fail "check-brief: rejects non-implementer persona" "$(cat $SCRATCH/out)"

# ─── validate-self-review ────────────────────────────────────────────────
section "validate-self-review"

# Reuse $SCRATCH/proj which has a valid session.yml from earlier check-brief test
cd "$SCRATCH/proj"

# Test 1: missing body
rm -f .agent-squad/pr-body.md
echo '{}' | node "$ROOT/skills/finish-feature/hooks/validate-self-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "PR body not found" "$SCRATCH/out" \
  && pass "validate-self-review: rejects missing body" || fail "validate-self-review: rejects missing body" "$(cat $SCRATCH/out)"

# Test 2: incomplete body
cat > .agent-squad/pr-body.md <<'PR'
## Agent Brief

Build CRUD endpoints.
PR
echo '{}' | node "$ROOT/skills/finish-feature/hooks/validate-self-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "Agent self-review" "$SCRATCH/out" \
  && pass "validate-self-review: rejects body missing self-review header" || fail "validate-self-review: rejects body missing self-review header" "$(cat $SCRATCH/out)"

# Test 3: complete valid body (re-ensure session.yml exists from check-brief test #3)
cat > briefs/42.md <<'B'
---
issue: 42
role: backend-dev
---

# Brief

## Testable Check

pytest tests/test_api.py
B
echo '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}' | node "$ROOT/skills/implement/hooks/check-brief-and-contract.js" >/dev/null 2>&1

cat > .agent-squad/pr-body.md <<'PR'
## Agent Brief

pytest tests/test_api.py

## Agent self-review — backend-dev

### What I actively checked
- Re-read app/api.py against the brief
- Walked the diff for stray console statements
- Confirmed test names match acceptance criteria

### Testable Check verification
Command run:    pytest tests/test_api.py
Output:
    3 passed in 0.05s
Result:         passed - all three CRUD cases green

### Files changed
- app/api.py: added create/list/delete endpoints
- tests/test_api.py: covers all three

### Tests written or updated
tests/test_api.py - three cases covering create, list, delete

### Issues I found and chose not to fix in this PR
No issues found.
PR
echo '{}' | node "$ROOT/skills/finish-feature/hooks/validate-self-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "validate-self-review: valid implementer body passes" || fail "validate-self-review: valid implementer body passes" "exit=$?  out=$(cat $SCRATCH/out)"

# Test 4: body with placeholder strings should fail
cat > .agent-squad/pr-body.md <<'PR'
## Agent Brief

<paste the testable check here>

## Agent self-review — backend-dev

### What I actively checked
- foo
- bar
- baz

### Testable Check verification
Command run: x
Output: y
Result: passed

### Files changed
- app/api.py

### Tests written or updated
tests/test_x.py - covers x

### Issues I found and chose not to fix in this PR
none
PR
echo '{}' | node "$ROOT/skills/finish-feature/hooks/validate-self-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 1 ] && grep -q "placeholder" "$SCRATCH/out" \
  && pass "validate-self-review: rejects placeholder strings" || fail "validate-self-review: rejects placeholder strings" "$(cat $SCRATCH/out)"

# ─── move-to-pr-review ───────────────────────────────────────────────────
section "move-to-pr-review"

# Test 1: no .ai-dlc.yml — should still pass (no-op)
rm -f .ai-dlc.yml
echo '{"event":"post-pr","issue_number":42,"pr_url":"https://example/pr/1"}' | node "$ROOT/skills/finish-feature/hooks/move-to-pr-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && pass "move-to-pr-review: no board config passes" || fail "move-to-pr-review: no board config passes" "$(cat $SCRATCH/out)"

# Test 2: with board config — emits NEXT_STEP
cat > .ai-dlc.yml <<'C'
github_repo: example/repo
C
# Re-create session marker (the previous test archived it)
mkdir -p .agent-squad
cat > .agent-squad/session.yml <<'M'
construct_version: 0.1.0
role: backend-dev
M
echo '{"event":"post-pr","issue_number":42,"pr_url":"https://example/pr/1"}' | node "$ROOT/skills/finish-feature/hooks/move-to-pr-review.js" >"$SCRATCH/out" 2>&1
[ $? -eq 0 ] && grep -q "NEXT_STEP move_issue_status issue=42" "$SCRATCH/out" \
  && pass "move-to-pr-review: emits NEXT_STEP when board configured" || fail "move-to-pr-review: emits NEXT_STEP when board configured" "$(cat $SCRATCH/out)"

# ─── summary ─────────────────────────────────────────────────────────────
section "summary"
echo "  passed: $PASS"
echo "  failed: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILED:"
  for f in "${FAIL_NAMES[@]}"; do echo "  - $f"; done
  exit 1
fi
exit 0
