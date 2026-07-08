#!/usr/bin/env node
// ci-dry-run - mirror what plugin-ci.yml does, locally and cross-platform.
// Run before pushing to catch issues without consuming CI minutes:
//   node tests/ci-dry-run.js        (or tests/ci-dry-run.ps1 / ci-dry-run.sh)
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failed = false;

function stage(n, title) {
  console.log('');
  console.log('=== ' + n + '. ' + title + ' ===');
}

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', ...(opts || {}) });
  if (r.status !== 0) failed = true;
  return r.status === 0;
}

function runNode(args) {
  return run(process.execPath, args);
}

// List files matching <dir>/<pattern> one level deep; pattern is a suffix.
function filesIn(dir, suffix) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith(suffix) && fs.statSync(path.join(abs, f)).isFile())
    .map(f => path.join(dir, f));
}

function subdirs(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(d => fs.statSync(path.join(abs, d)).isDirectory())
    .map(d => dir + '/' + d);
}

stage(1, 'validate plugin.json');
try {
  JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  console.log('  ok');
} catch (e) { console.error('  FAIL: ' + e.message); failed = true; }

stage(2, 'validate marketplace.json');
try {
  JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  console.log('  ok');
} catch (e) { console.error('  FAIL: ' + e.message); failed = true; }

stage(3, 'hook syntax check');
{
  let scripts = []
    .concat(filesIn('hooks', '.js'))
    .concat(filesIn('hooks/lib', '.js'))
    .concat(filesIn('bin', '.js'))
    .concat(filesIn('tests', '.js'))
    .concat(filesIn('tests/lib', '.js'));
  for (const d of subdirs('skills')) {
    scripts = scripts.concat(filesIn(d + '/hooks', '.js'));
  }
  for (const s of scripts) {
    console.log('  ' + s);
    if (!runNode(['--check', path.join(ROOT, s)])) failed = true;
  }
}

stage(4, 'validate persona frontmatter');
runNode([path.join(ROOT, 'bin', 'validate-frontmatter.js')]
  .concat(filesIn('personas', '.md').map(p => path.join(ROOT, p))));

stage(5, 'validate skill frontmatter');
{
  let skills = [];
  for (const d of subdirs('skills')) {
    const p = path.join(ROOT, d, 'SKILL.md');
    if (fs.existsSync(p)) skills.push(p);
  }
  for (const d of subdirs('skills/domain')) {
    const p = path.join(ROOT, d, 'SKILL.md');
    if (fs.existsSync(p)) skills.push(p);
  }
  runNode([path.join(ROOT, 'bin', 'validate-frontmatter.js')].concat(skills));
}

stage(6, 'validate example AGENTS.md role schema');
runNode([path.join(ROOT, 'bin', 'validate-role-schema.js'), path.join(ROOT, 'examples', 'AGENTS.md.example')]);

stage(7, 'smoke tests');
runNode([path.join(ROOT, 'tests', 'run.js')]);

console.log('');
if (failed) {
  console.log('=== CI DRY-RUN FAILED ===');
  process.exit(1);
}
console.log('=== ALL CHECKS PASSED ===');
