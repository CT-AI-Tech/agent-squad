#!/usr/bin/env node
// agent-squad smoke tests (cross-platform Node port of the former run.sh).
// Run directly (node tests/run.js) or via the tests/run.sh / tests/run.ps1
// wrappers. Exit code is non-zero if any test fails.
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT, SCRATCH,
  section, pass, fail, check,
  write, read, runNode, git, initRepo, summary
} = require('./lib/harness');

const BIN = n => path.join(ROOT, 'bin', n);
const HOOK = n => path.join(ROOT, 'hooks', n);
const SKILLHOOK = (s, n) => path.join(ROOT, 'skills', s, 'hooks', n);

// ─── validate-frontmatter ────────────────────────────────────────────────
section('validate-frontmatter');

{
  let r = runNode(BIN('validate-frontmatter.js'), {
    args: ['lead', 'architect', 'implementer'].map(p => path.join(ROOT, 'personas', p + '.md'))
  });
  check('personas validate', r.status === 0, r.stdout + r.stderr);

  r = runNode(BIN('validate-frontmatter.js'), {
    args: [path.join(ROOT, 'skills', 'implement', 'SKILL.md'), path.join(ROOT, 'skills', 'finish-feature', 'SKILL.md')]
  });
  check('skills validate', r.status === 0, r.stdout + r.stderr);

  const stubs = ['aws', 'python', 'fastapi', 'postgres', 'react', 'typescript', 'docker', 'terraform', 'github-actions']
    .map(d => path.join(ROOT, 'skills', 'domain', d, 'SKILL.md'));
  r = runNode(BIN('validate-frontmatter.js'), { args: stubs });
  check('domain skill stubs validate', r.status === 0, r.stdout + r.stderr);

  const badPersona = path.join(SCRATCH, 'bad-persona.md');
  write(badPersona, '---\nname: lead\nversion: 0.1.0\n---\nbody\n');
  r = runNode(BIN('validate-frontmatter.js'), { args: ['--kind', 'persona', badPersona] });
  check('rejects persona missing fields',
    r.status === 1 && /missing required field/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  const badName = path.join(SCRATCH, 'bad-name.md');
  write(badName, [
    '---', 'name: random-name', 'version: 0.1.0', 'construct_version: 0.1.0',
    'description: x', 'owner: x', 'behavior:', '  invoked_when: []', '  outputs: []',
    '  prohibited: []', 'default_mode: execute', 'plan_mode_triggers: []',
    'self_review_format: x', '---', 'body', ''
  ].join('\n'));
  r = runNode(BIN('validate-frontmatter.js'), { args: ['--kind', 'persona', badName] });
  check('rejects unknown persona name',
    r.status === 1 && /not in the v0\.x persona set/.test(r.stdout + r.stderr), r.stdout + r.stderr);
}

// ─── validate-role-schema ────────────────────────────────────────────────
section('validate-role-schema');

{
  let r = runNode(BIN('validate-role-schema.js'), { args: [path.join(ROOT, 'examples', 'AGENTS.md.example')] });
  check('example AGENTS.md validates', r.status === 0, r.stdout + r.stderr);

  const noLead = path.join(SCRATCH, 'no-lead.md');
  write(noLead, [
    '# x', '```yaml', 'construct_version: ">=0.1.0"', 'roles:',
    '  - name: backend', '    persona: implementer', '    skills: []',
    '    lanes:', '      write: [src/]', '```', ''
  ].join('\n'));
  r = runNode(BIN('validate-role-schema.js'), { args: [noLead] });
  check('rejects roles with no lead',
    r.status === 1 && /lead/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  const dup = path.join(SCRATCH, 'dup.md');
  write(dup, [
    '# x', '```yaml', 'construct_version: ">=0.1.0"', 'roles:',
    '  - name: lead', '    persona: lead', '    skills: []', '    lanes: {write: []}',
    '  - name: dev', '    persona: implementer', '    skills: []', '    lanes: {write: [src/]}',
    '  - name: dev', '    persona: implementer', '    skills: []', '    lanes: {write: [src/]}',
    '```', ''
  ].join('\n'));
  r = runNode(BIN('validate-role-schema.js'), { args: [dup] });
  check('rejects duplicate role names',
    r.status === 1 && /more than once/.test(r.stdout + r.stderr), r.stdout + r.stderr);
}

// ─── role templates (examples/roles/) ────────────────────────────────────
section('role templates');

{
  const rolesDir = path.join(ROOT, 'examples', 'roles');
  const fragments = fs.readdirSync(rolesDir).filter(f => f.endsWith('.role.md')).sort();
  for (const f of fragments) {
    const base = f.replace(/\.role\.md$/, '');
    const text = read(path.join(rolesDir, f)) || '';
    const m = text.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
    if (!m || !m[1].trim()) {
      fail('role template: ' + base + ' extracts yaml', 'yaml block empty or missing');
      continue;
    }
    const indented = m[1].split(/\r?\n/).map(l => '  ' + l).join('\n');
    let composed = '# test\n```yaml\nconstruct_version: ">=0.1.0"\nroles:\n';
    if (!/persona:\s*lead/.test(m[1])) {
      composed += '  - name: lead\n    persona: lead\n    skills: []\n    lanes:\n      write: []\n';
    }
    composed += indented + '\n```\n';
    const out = path.join(SCRATCH, 'role-test-' + base + '.md');
    write(out, composed);
    const r = runNode(BIN('validate-role-schema.js'), { args: [out] });
    check('role template: ' + base + ' validates when composed', r.status === 0, r.stdout + r.stderr);
  }
}

// ─── branch-guard ────────────────────────────────────────────────────────
section('branch-guard');

const repo = initRepo('repo');
{
  git(['checkout', '-q', '-b', 'feature/42-test'], repo);

  let r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"foo.py"}}', cwd: SCRATCH
  });
  check('branch-guard: passes outside git repo', r.status === 0, r.stdout + r.stderr);

  git(['checkout', '-q', 'main'], repo);
  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"seed.txt"}}', cwd: repo
  });
  check('branch-guard: blocks on main',
    r.status === 2 && /branch/.test(r.stdout), 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  const outside = path.join(SCRATCH, 'outside-repo.md');
  r = runNode(HOOK('branch-guard.js'), {
    stdin: JSON.stringify({ tool_input: { file_path: outside } }), cwd: repo
  });
  check('branch-guard: allows outside-repo path on main', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":".agent-squad/brief.md"}}', cwd: repo
  });
  check('branch-guard: allows .agent-squad/ on main', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  git(['checkout', '-q', 'feature/42-test'], repo);
  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"seed.txt"}}', cwd: repo
  });
  check('branch-guard: allows on feature, no marker', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(repo, '.agent-squad', 'session.yml'), [
    'construct_version: 0.1.0', 'role: backend-dev', 'persona: implementer',
    'write_lanes:', '  - app/', '  - tests/', ''
  ].join('\n'));
  fs.mkdirSync(path.join(repo, 'app'), { recursive: true });
  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"app/foo.py"}}', cwd: repo
  });
  check('branch-guard: allows file in write lane', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"frontend/page.tsx"}}', cwd: repo
  });
  check('branch-guard: blocks file outside lane',
    r.status === 2 && /outside the write lane/.test(r.stdout), 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":".agent-squad/pr-body.md"}}', cwd: repo
  });
  check('branch-guard: allows .agent-squad/ despite lanes', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(repo, '.ai-dlc.yml'), 'hooks:\n  branch_guard: warn\n');
  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"frontend/page.tsx"}}', cwd: repo
  });
  check('branch-guard: warn mode allows', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(repo, '.ai-dlc.yml'), 'hooks:\n  branch_guard: disabled\n');
  git(['checkout', '-q', 'main'], repo);
  r = runNode(HOOK('branch-guard.js'), {
    stdin: '{"tool_input":{"file_path":"seed.txt"}}', cwd: repo
  });
  check('branch-guard: disabled allows on main', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);
}

// ─── rebase-guard ────────────────────────────────────────────────────────
section('rebase-guard');

{
  let r = runNode(HOOK('rebase-guard.js'), {
    stdin: '{"tool_input":{"command":"ls"}}', cwd: repo
  });
  check('rebase-guard: non-commit command passes', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(HOOK('rebase-guard.js'), { stdin: 'not json', cwd: repo });
  check('rebase-guard: bad payload does not crash', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  git(['checkout', '-q', 'feature/42-test'], repo);
  write(path.join(repo, '.ai-dlc.yml'), 'hooks:\n  rebase_guard: warn\n');
  r = runNode(HOOK('rebase-guard.js'), {
    stdin: '{"tool_input":{"command":"git commit -m test"}}', cwd: repo
  });
  check('rebase-guard: warn mode allows commit', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(repo, '.ai-dlc.yml'), 'hooks:\n  rebase_guard: disabled\n');
  r = runNode(HOOK('rebase-guard.js'), {
    stdin: '{"tool_input":{"command":"git commit -m test"}}', cwd: repo
  });
  check('rebase-guard: disabled allows', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);
}

// ─── check-brief-and-contract ────────────────────────────────────────────
section('check-brief-and-contract');

const proj = path.join(SCRATCH, 'proj');
{
  fs.mkdirSync(proj, { recursive: true });
  git(['init', '-q', '-b', 'main'], proj);
  git(['config', 'user.email', 'test@test'], proj);
  git(['config', 'user.name', 'test'], proj);
  write(path.join(proj, 'AGENTS.md'), [
    '# project', '```yaml', 'construct_version: ">=0.1.0"', 'roles:',
    '  - name: lead', '    persona: lead', '    skills: []', '    lanes:', '      write: []',
    '  - name: backend-dev', '    persona: implementer', '    skills: [python]',
    '    lanes:', '      write:', '        - app/', '        - tests/',
    '      read:', '        - docs/contracts/', '```', ''
  ].join('\n'));
  git(['add', 'AGENTS.md'], proj);
  git(['commit', '-q', '-m', 'init'], proj);

  const CHK = SKILLHOOK('implement', 'check-brief-and-contract.js');
  const payload42 = '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}';

  let r = runNode(CHK, { stdin: payload42, cwd: proj });
  check('check-brief: rejects missing brief',
    r.status === 1 && /no brief found/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(path.join(proj, 'briefs', '42.md'),
    '---\nissue: 42\nrole: backend-dev\n---\n\n# Brief\n\nSome description.\n');
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  check('check-brief: rejects brief without testable check',
    r.status === 1 && /Testable Check/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  const validBrief = '---\nissue: 42\nrole: backend-dev\n---\n\n# Brief\n\nBuild CRUD endpoints.\n\n## Testable Check\n\npytest tests/test_api.py\n';
  write(path.join(proj, 'briefs', '42.md'), validBrief);
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  const marker1 = read(path.join(proj, '.agent-squad', 'session.yml')) || '';
  check('check-brief: valid brief writes session marker',
    r.status === 0 && /role: backend-dev/.test(marker1),
    'exit=' + r.status + ' out=' + r.stdout + r.stderr + ' marker=' + marker1);

  write(path.join(proj, 'briefs', '42.md'),
    '---\nissue: 42\nrole: backend-dev\ncontract: docs/contracts/api-todo.md\n---\n\n# Brief\n\nBuild CRUD endpoints per locked contract.\n\n## Testable Check\n\npytest tests/test_api.py\n');
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  check('check-brief: rejects when contract not in main',
    r.status === 1 && /contract/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(path.join(proj, 'docs', 'contracts', 'api-todo.md'), '# API contract\n');
  git(['add', 'docs/contracts'], proj);
  git(['commit', '-q', '-m', 'contract'], proj);
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  check('check-brief: passes with contract in main', r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(CHK, { stdin: '{"event":"pre-implement","issue_number":42,"role":"nonexistent-role"}', cwd: proj });
  check('check-brief: rejects unknown role',
    r.status === 1 && /not found/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(path.join(proj, 'briefs', '99.md'),
    '---\nissue: 99\nrole: lead\n---\n\n# Brief\n\n## Testable Check\n\nsomething\n');
  r = runNode(CHK, { stdin: '{"event":"pre-implement","issue_number":99,"role":"lead"}', cwd: proj });
  check('check-brief: rejects non-implementer persona',
    r.status === 1 && /implementer/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  // v0.4: estimate validation + marker copy
  write(path.join(proj, 'briefs', '42.md'),
    '---\nissue: 42\nrole: backend-dev\nestimate: XXL\n---\n\n# Brief\n\n## Testable Check\n\npytest tests/test_api.py\n');
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  check('check-brief: rejects invalid estimate',
    r.status === 1 && /estimate/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(path.join(proj, 'briefs', '42.md'),
    '---\nissue: 42\nrole: backend-dev\nestimate: m\n---\n\n# Brief\n\n## Testable Check\n\npytest tests/test_api.py\n');
  r = runNode(CHK, { stdin: payload42, cwd: proj });
  const marker2 = read(path.join(proj, '.agent-squad', 'session.yml')) || '';
  check('check-brief: valid estimate lands in marker',
    r.status === 0 && /estimate: M/.test(marker2),
    'exit=' + r.status + ' out=' + r.stdout + r.stderr + ' marker=' + marker2);
}

// ─── validate-self-review ────────────────────────────────────────────────
section('validate-self-review');

{
  const VSR = SKILLHOOK('finish-feature', 'validate-self-review.js');
  const prBody = path.join(proj, '.agent-squad', 'pr-body.md');

  const VALID_BODY = [
    '## Agent Brief', '',
    'pytest tests/test_api.py', '',
    '## Agent self-review - backend-dev', '',
    '### What I actively checked',
    '- Re-read app/api.py against the brief',
    '- Walked the diff for stray console statements',
    '- Confirmed test names match acceptance criteria', '',
    '### Testable Check verification',
    'Command run:    pytest tests/test_api.py',
    'Output:',
    '    3 passed in 0.05s',
    'Result:         passed - all three CRUD cases green', '',
    '### How to test',
    '1. pip install -e . and start the API with uvicorn app.main:app',
    '2. curl -X POST localhost:8000/todos -d "{}" and expect a 201 with an id', '',
    '### Files changed',
    '- app/api.py: added create/list/delete endpoints',
    '- tests/test_api.py: covers all three', '',
    '### Tests written or updated',
    'tests/test_api.py - three cases covering create, list, delete', '',
    '### Issues I found and chose not to fix in this PR',
    'No issues found.', ''
  ].join('\n');

  try { fs.unlinkSync(prBody); } catch {}
  let r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: rejects missing body',
    r.status === 1 && /PR body not found/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(prBody, '## Agent Brief\n\nBuild CRUD endpoints.\n');
  r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: rejects body missing self-review header',
    r.status === 1 && /Agent self-review/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(prBody, VALID_BODY);
  r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: valid implementer body passes',
    r.status === 0, 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(prBody, VALID_BODY
    .replace('pytest tests/test_api.py\n\n## Agent self-review', '<paste the testable check here>\n\n## Agent self-review'));
  r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: rejects placeholder strings',
    r.status === 1 && /placeholder/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  // v0.4: How to test section required
  const noHowTo = VALID_BODY.split('\n')
    .filter((l, i, arr) => {
      const start = arr.indexOf('### How to test');
      return i < start || i > start + 3;
    }).join('\n');
  write(prBody, noHowTo);
  r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: rejects missing How to test',
    r.status === 1 && /How to test/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  write(prBody, VALID_BODY.replace(
    '### How to test\n1. pip install -e . and start the API with uvicorn app.main:app\n2. curl -X POST localhost:8000/todos -d "{}" and expect a 201 with an id',
    '### How to test\nworks'));
  r = runNode(VSR, { stdin: '{}', cwd: proj });
  check('validate-self-review: rejects empty How to test',
    r.status === 1 && /How to test/.test(r.stdout + r.stderr), r.stdout + r.stderr);
}

// ─── move-to-pr-review ───────────────────────────────────────────────────
section('move-to-pr-review');

{
  const MPR = SKILLHOOK('finish-feature', 'move-to-pr-review.js');
  const payload = '{"event":"post-pr","issue_number":42,"pr_url":"https://example/pr/1"}';

  try { fs.unlinkSync(path.join(proj, '.ai-dlc.yml')); } catch {}
  let r = runNode(MPR, { stdin: payload, cwd: proj });
  check('move-to-pr-review: no board config passes', r.status === 0, r.stdout + r.stderr);

  write(path.join(proj, '.ai-dlc.yml'), 'github_repo: example/repo\n');
  write(path.join(proj, '.agent-squad', 'session.yml'),
    'construct_version: 0.1.0\nrole: backend-dev\n');
  r = runNode(MPR, { stdin: payload, cwd: proj });
  check('move-to-pr-review: emits NEXT_STEP when board configured',
    r.status === 0 && /NEXT_STEP move_issue_status issue=42/.test(r.stdout), r.stdout + r.stderr);

  // v0.4: USAGE_TOTAL emission with estimate from the marker
  write(path.join(proj, '.agent-squad', 'session.yml'), [
    'construct_version: 0.4.0', 'role: backend-dev', 'issue: 42',
    'persona: implementer', 'estimate: M', ''
  ].join('\n'));
  write(path.join(proj, '.agent-squad', 'usage.json'), JSON.stringify({
    issues: {
      '42': {
        sessions: {
          s1: { input: 100, output: 50, cache_read: 1000, cache_create: 10 },
          s2: { input: 200, output: 150, cache_read: 2000, cache_create: 20 }
        }
      }
    }
  }, null, 2));
  r = runNode(MPR, { stdin: payload, cwd: proj });
  check('move-to-pr-review: emits USAGE_TOTAL with estimate',
    r.status === 0 &&
    /USAGE_TOTAL issue=42 input=300 output=200 cache_read=3000 cache_create=30 estimate=M/.test(r.stdout),
    'exit=' + r.status + ' out=' + r.stdout + r.stderr);
}

// ─── model hint validation ───────────────────────────────────────────────
section('model hint validation');

{
  const okPersona = path.join(SCRATCH, 'model-ok', 'lead.md');
  write(okPersona, [
    '---', 'name: lead', 'version: 0.1.0', 'construct_version: 0.1.0',
    'description: x', 'owner: x', 'model: opus', 'behavior:',
    '  invoked_when: []', '  outputs: []', '  prohibited: []',
    'default_mode: execute', 'plan_mode_triggers: []', 'self_review_format: x',
    '---', 'body', ''
  ].join('\n'));
  let r = runNode(BIN('validate-frontmatter.js'), { args: ['--kind', 'persona', okPersona] });
  check('frontmatter: accepts model opus', r.status === 0, r.stdout + r.stderr);

  const badPersona = path.join(SCRATCH, 'model-bad', 'lead.md');
  write(badPersona, read(okPersona).replace('model: opus', 'model: gpt5'));
  r = runNode(BIN('validate-frontmatter.js'), { args: ['--kind', 'persona', badPersona] });
  check('frontmatter: rejects model gpt5',
    r.status === 1 && /model/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  const roleModel = path.join(SCRATCH, 'role-model.md');
  write(roleModel, [
    '# x', '```yaml', 'construct_version: ">=0.3.0"', 'roles:',
    '  - name: lead', '    persona: lead', '    skills: []', '    lanes: {write: []}',
    '  - name: backend-dev', '    persona: implementer', '    skills: []',
    '    model: haiku', '    lanes: {write: [src/]}', '```', ''
  ].join('\n'));
  r = runNode(BIN('validate-role-schema.js'), { args: [roleModel] });
  check('role-schema: accepts role model haiku', r.status === 0, r.stdout + r.stderr);

  const roleModelBad = path.join(SCRATCH, 'role-model-bad.md');
  write(roleModelBad, read(roleModel).replace('model: haiku', 'model: gpt5'));
  r = runNode(BIN('validate-role-schema.js'), { args: [roleModelBad] });
  check('role-schema: rejects role model gpt5',
    r.status === 1 && /model/.test(r.stdout + r.stderr), r.stdout + r.stderr);
}

// ─── squad-session / squad-status / session-context ─────────────────────
section('squad-session / squad-status / session-context');

{
  const proj2 = path.join(SCRATCH, 'proj2');
  fs.mkdirSync(proj2, { recursive: true });
  git(['init', '-q', '-b', 'main'], proj2);
  git(['config', 'user.email', 'test@test'], proj2);
  git(['config', 'user.name', 'test'], proj2);
  write(path.join(proj2, 'AGENTS.md'), [
    '# project', '```yaml', 'construct_version: ">=0.3.0"', 'roles:',
    '  - name: lead', '    persona: lead', '    skills: []',
    '    lanes:', '      write: [docs/adr/]',
    '  - name: backend-dev', '    persona: implementer', '    skills: [python]',
    '    model: haiku', '    lanes:', '      write: [app/, tests/]', '```', ''
  ].join('\n'));
  git(['add', 'AGENTS.md'], proj2);
  git(['commit', '-q', '-m', 'init'], proj2);

  let r = runNode(BIN('squad-status.js'), { cwd: proj2 });
  check('squad-status: silent without marker',
    r.status === 0 && (r.stdout + r.stderr).trim() === '', 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(HOOK('session-context.js'), { stdin: '{}', cwd: proj2 });
  check('session-context: silent without marker',
    r.status === 0 && (r.stdout + r.stderr).trim() === '', 'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  r = runNode(BIN('squad-session.js'), { args: ['set', 'backend-dev', '--issue', '7'], cwd: proj2 });
  const m1 = read(path.join(proj2, '.agent-squad', 'session.yml')) || '';
  check('squad-session: set writes marker with role model',
    r.status === 0 && /persona: implementer/.test(m1) && /model: haiku/.test(m1),
    r.stdout + r.stderr + '\n' + m1);

  r = runNode(BIN('squad-status.js'), { cwd: proj2 });
  check('squad-status: renders active role line',
    r.stdout.includes('[agent-squad] implementer:backend-dev #7 (haiku)'), 'out=' + r.stdout);

  r = runNode(HOOK('session-context.js'), { stdin: '{"hook_event_name":"UserPromptSubmit"}', cwd: proj2 });
  check('session-context: injects active role context',
    r.status === 0 && r.stdout.includes('"additionalContext"') &&
    r.stdout.includes('implementer') && r.stdout.includes('backend-dev'),
    'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(proj2, '.ai-dlc.yml'), 'hooks:\n  session_context: disabled\n');
  r = runNode(HOOK('session-context.js'), { stdin: '{}', cwd: proj2 });
  check('session-context: disabled mode is silent',
    r.status === 0 && (r.stdout + r.stderr).trim() === '', 'exit=' + r.status + ' out=' + r.stdout + r.stderr);
  fs.unlinkSync(path.join(proj2, '.ai-dlc.yml'));

  r = runNode(BIN('squad-session.js'), { args: ['set', 'lead'], cwd: proj2 });
  const m2 = read(path.join(proj2, '.agent-squad', 'session.yml')) || '';
  check('squad-session: lead marker uses persona default model',
    r.status === 0 && /persona: lead/.test(m2) && /model: opus/.test(m2),
    r.stdout + r.stderr + '\n' + m2);

  r = runNode(BIN('squad-session.js'), { args: ['set', 'nonexistent'], cwd: proj2 });
  check('squad-session: rejects unknown role',
    r.status === 1 && /not found/.test(r.stdout + r.stderr), r.stdout + r.stderr);

  r = runNode(BIN('squad-session.js'), { args: ['clear'], cwd: proj2 });
  check('squad-session: clear removes marker',
    r.status === 0 && !fs.existsSync(path.join(proj2, '.agent-squad', 'session.yml')),
    r.stdout + r.stderr);
}

// ─── check-brief model resolution ────────────────────────────────────────
section('check-brief model resolution');

{
  const proj3 = path.join(SCRATCH, 'proj3');
  fs.mkdirSync(proj3, { recursive: true });
  git(['init', '-q', '-b', 'main'], proj3);
  git(['config', 'user.email', 'test@test'], proj3);
  git(['config', 'user.name', 'test'], proj3);
  write(path.join(proj3, 'AGENTS.md'), [
    '# project', '```yaml', 'construct_version: ">=0.3.0"', 'roles:',
    '  - name: lead', '    persona: lead', '    skills: []', '    lanes:', '      write: []',
    '  - name: backend-dev', '    persona: implementer', '    skills: []',
    '    lanes:', '      write: [app/, tests/]', '```', ''
  ].join('\n'));
  git(['add', 'AGENTS.md'], proj3);
  git(['commit', '-q', '-m', 'init'], proj3);
  write(path.join(proj3, 'briefs', '42.md'),
    '---\nissue: 42\nrole: backend-dev\n---\n\n# Brief\n\n## Testable Check\n\npytest\n');

  const r = runNode(SKILLHOOK('implement', 'check-brief-and-contract.js'), {
    stdin: '{"event":"pre-implement","issue_number":42,"role":"backend-dev"}', cwd: proj3
  });
  const m = read(path.join(proj3, '.agent-squad', 'session.yml')) || '';
  check('check-brief: marker gets persona default model',
    r.status === 0 && /model: sonnet/.test(m), r.stdout + r.stderr + '\n' + m);
}

// ─── usage-tracker ───────────────────────────────────────────────────────
section('usage-tracker');

{
  const proj4 = path.join(SCRATCH, 'proj4');
  write(path.join(proj4, '.agent-squad', 'session.yml'), [
    'construct_version: 0.4.0', 'role: backend-dev', 'issue: 42',
    'persona: implementer', ''
  ].join('\n'));

  const transcript = path.join(SCRATCH, 'transcript.jsonl');
  write(transcript, [
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 10 } } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }),
    'this line is not json',
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: 200, output_tokens: 150, cache_read_input_tokens: 2000, cache_creation_input_tokens: 20 } } }),
    ''
  ].join('\n'));

  const UT = HOOK('usage-tracker.js');
  const ledgerPath = path.join(proj4, '.agent-squad', 'usage.json');
  const payload = sid => JSON.stringify({ session_id: sid, transcript_path: transcript });

  let r = runNode(UT, { stdin: payload('s1'), cwd: proj4 });
  let ledger = JSON.parse(read(ledgerPath) || '{}');
  let s1 = ledger.issues && ledger.issues['42'] && ledger.issues['42'].sessions && ledger.issues['42'].sessions.s1;
  check('usage-tracker: sums transcript into usage.json',
    r.status === 0 && s1 && s1.input === 300 && s1.output === 200 && s1.cache_read === 3000 && s1.cache_create === 30,
    'exit=' + r.status + ' ledger=' + JSON.stringify(ledger));

  r = runNode(UT, { stdin: payload('s1'), cwd: proj4 });
  ledger = JSON.parse(read(ledgerPath) || '{}');
  const sessions1 = Object.keys((ledger.issues['42'] || {}).sessions || {});
  s1 = ledger.issues['42'].sessions.s1;
  check('usage-tracker: idempotent on re-run (same session)',
    sessions1.length === 1 && s1.input === 300 && s1.output === 200,
    JSON.stringify(ledger));

  r = runNode(UT, { stdin: payload('s2'), cwd: proj4 });
  ledger = JSON.parse(read(ledgerPath) || '{}');
  const sessions2 = Object.keys((ledger.issues['42'] || {}).sessions || {});
  check('usage-tracker: second session accumulates',
    sessions2.length === 2 && ledger.issues['42'].sessions.s2.input === 300,
    JSON.stringify(ledger));

  const proj5 = path.join(SCRATCH, 'proj5');
  fs.mkdirSync(proj5, { recursive: true });
  r = runNode(UT, { stdin: payload('s1'), cwd: proj5 });
  check('usage-tracker: no marker exits 0 silently',
    r.status === 0 && (r.stdout + r.stderr).trim() === '' && !fs.existsSync(path.join(proj5, '.agent-squad', 'usage.json')),
    'exit=' + r.status + ' out=' + r.stdout + r.stderr);

  write(path.join(proj4, '.ai-dlc.yml'), 'hooks:\n  usage_tracker: disabled\n');
  r = runNode(UT, { stdin: payload('s3'), cwd: proj4 });
  ledger = JSON.parse(read(ledgerPath) || '{}');
  check('usage-tracker: disabled mode skips',
    r.status === 0 && !(ledger.issues['42'].sessions || {}).s3,
    JSON.stringify(ledger));
}

// ─── init skill artifacts ────────────────────────────────────────────────
section('init skill artifacts');

{
  let r = runNode(BIN('validate-frontmatter.js'), { args: [path.join(ROOT, 'skills', 'init', 'SKILL.md')] });
  check('init: SKILL.md frontmatter validates', r.status === 0, r.stdout + r.stderr);

  let ok = true, ctx = '';
  try {
    require('js-yaml').load(read(path.join(ROOT, 'skills', 'init', 'templates', 'ai-dlc.yml')));
  } catch (e) { ok = false; ctx = e.message; }
  check('init: ai-dlc.yml template parses', ok, ctx);

  let hooksJson = '';
  try { hooksJson = JSON.stringify(JSON.parse(read(path.join(ROOT, 'hooks', 'hooks.json')))); ok = true; }
  catch (e) { ok = false; ctx = e.message; }
  check('hooks.json: registers session-context', ok && hooksJson.includes('session-context.js'), ctx || hooksJson);

  check('hooks.json: registers usage-tracker on Stop',
    hooksJson.includes('"Stop"') && hooksJson.includes('usage-tracker.js'), hooksJson);
}

summary();
