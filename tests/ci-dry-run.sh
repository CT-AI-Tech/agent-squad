#!/usr/bin/env bash
# tests/ci-dry-run.sh — mirror what plugin-ci.yml does, locally.
# Run before pushing to GitHub to catch issues without consuming CI minutes.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══ 1. validate plugin.json ═══"
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json'))"
echo "  ok"

echo ""
echo "═══ 2. validate marketplace.json ═══"
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))"
echo "  ok"

echo ""
echo "═══ 3. hook syntax check ═══"
for f in hooks/*.js; do
  [ -f "$f" ] || continue
  echo "  $f"
  node --check "$f"
done
for f in skills/core/*/hooks/*.js; do
  [ -f "$f" ] || continue
  echo "  $f"
  node --check "$f"
done

echo ""
echo "═══ 4. validate persona frontmatter ═══"
node bin/validate-frontmatter.js personas/*.md

echo ""
echo "═══ 5. validate skill frontmatter ═══"
for skill in skills/core/*/SKILL.md skills/domain/*/SKILL.md; do
  [ -f "$skill" ] || continue
  node bin/validate-frontmatter.js "$skill"
done

echo ""
echo "═══ 6. validate example AGENTS.md role schema ═══"
node bin/validate-role-schema.js examples/AGENTS.md.example

echo ""
echo "═══ 7. smoke tests ═══"
bash tests/run.sh

echo ""
echo "═══ ALL CHECKS PASSED ═══"
