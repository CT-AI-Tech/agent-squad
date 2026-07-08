// harness - shared helpers for the agent-squad smoke tests (tests/run.js).
// Cross-platform by construction: Node built-ins only, no shell required.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-squad-test-'));

let PASS = 0;
let FAIL = 0;
const FAIL_NAMES = [];

process.on('exit', () => {
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch {}
});

function section(title) {
  console.log('');
  console.log('=== ' + title + ' ===');
}

function pass(name) {
  PASS++;
  console.log('  [ok] ' + name);
}

function fail(name, context) {
  FAIL++;
  FAIL_NAMES.push(name);
  console.log('  [FAIL] ' + name);
  if (context) {
    String(context).split(/\r?\n/).forEach(l => console.log('    ' + l));
  }
}

function check(name, condition, context) {
  if (condition) pass(name); else fail(name, context);
}

// Write a file, creating parent dirs. Content is written verbatim.
function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function read(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

// Run a node script with optional stdin payload and cwd.
// Returns { status, stdout, stderr }.
function runNode(scriptPath, opts) {
  opts = opts || {};
  const r = spawnSync(process.execPath, [scriptPath].concat(opts.args || []), {
    input: opts.stdin !== undefined ? opts.stdin : '',
    cwd: opts.cwd || SCRATCH,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) }
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Run git. Returns { status, stdout, stderr }.
function git(args, cwd) {
  const r = spawnSync('git', args, { cwd: cwd, encoding: 'utf8' });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

// Create a scratch git repo at SCRATCH/<name> on branch main with one commit.
function initRepo(name) {
  const dir = path.join(SCRATCH, name);
  fs.mkdirSync(dir, { recursive: true });
  git(['init', '-q', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@test'], dir);
  git(['config', 'user.name', 'test'], dir);
  write(path.join(dir, 'seed.txt'), 'x\n');
  git(['add', '.'], dir);
  git(['commit', '-q', '-m', 'init'], dir);
  return dir;
}

function summary() {
  section('summary');
  console.log('  passed: ' + PASS);
  console.log('  failed: ' + FAIL);
  if (FAIL > 0) {
    console.log('');
    console.log('FAILED:');
    FAIL_NAMES.forEach(n => console.log('  - ' + n));
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

module.exports = {
  ROOT, SCRATCH,
  section, pass, fail, check,
  write, read, runNode, git, initRepo, summary
};
