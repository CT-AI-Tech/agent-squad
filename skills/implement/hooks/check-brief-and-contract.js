#!/usr/bin/env node
// check-brief-and-contract - pre-implement lifecycle hook
//
// Fires before the Implementer's first edit. Validates the brief exists, the
// contract (if flagged) is in the default branch, and writes the resolved
// session marker (.agent-squad/session.yml) for downstream hooks to consume.
//
// Stdin payload (lifecycle hook context):
//   { event: "pre-implement", issue_number, branch, role, ... }
//
// Exit codes:
//   0  - pass, continue
//   1  - block, message in stdout
//   2  - warn, message in stdout but continue
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let yaml;
try {
  yaml = require('js-yaml');
} catch {
  console.log('check-brief-and-contract: js-yaml not found. Run `npm install` in the agent-squad directory.');
  process.exit(1);
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function tryGit(args, opts) {
  opts = opts || {};
  const r = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...opts
  });
  return { ok: r.status === 0, stdout: (r.stdout || '').toString().trim(), stderr: (r.stderr || '').toString().trim() };
}

function findBrief(issue) {
  // Search order: .agent-squad/brief.md, briefs/<issue>.md, briefs/<issue>-*.md
  const candidates = [
    path.resolve(process.cwd(), '.agent-squad', 'brief.md'),
    path.resolve(process.cwd(), 'briefs', String(issue) + '.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Glob: briefs/<issue>-*.md
  const briefsDir = path.resolve(process.cwd(), 'briefs');
  if (fs.existsSync(briefsDir)) {
    const re = new RegExp('^' + String(issue) + '-.+\\.md$');
    const match = fs.readdirSync(briefsDir).find(f => re.test(f));
    if (match) return path.join(briefsDir, match);
  }
  return null;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  try { return yaml.load(m[1]); } catch { return null; }
}

function readRoleFromAgentsFile(roleName) {
  const p = path.resolve(process.cwd(), 'AGENTS.md');
  if (!fs.existsSync(p)) {
    return { error: 'AGENTS.md not found in ' + process.cwd() };
  }
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!m) return { error: 'AGENTS.md has no ```yaml fenced block' };
  let doc;
  try { doc = yaml.load(m[1]); } catch (e) { return { error: 'AGENTS.md YAML parse failed: ' + e.message }; }
  if (!doc || !Array.isArray(doc.roles)) return { error: 'AGENTS.md has no roles list' };
  const role = doc.roles.find(r => r && r.name === roleName);
  if (!role) return { error: 'Role "' + roleName + '" not found in AGENTS.md' };
  return { role: role };
}

function defaultBranch() {
  const r = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (r.ok && r.stdout) return r.stdout.replace(/^origin\//, '');
  return 'main';
}

const MODEL_VALUES = ['opus', 'sonnet', 'haiku', 'inherit'];

function personaDefaultModel(persona) {
  const p = path.resolve(__dirname, '..', '..', '..', 'personas', persona + '.md');
  if (!fs.existsSync(p)) return null;
  const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
  if (fm && fm.model && MODEL_VALUES.includes(fm.model)) return fm.model;
  return null;
}

// ─── main ────────────────────────────────────────────────────────────────
let payload;
try { payload = JSON.parse(readStdin() || '{}'); }
catch { payload = {}; }

const issue = payload.issue_number || payload.issue;
const role = payload.role;

if (!role) {
  console.log('pre-implement hook: payload missing required field "role".');
  process.exit(1);
}

// 1. Brief must exist and have testable_check content
const briefPath = findBrief(issue);
if (!briefPath) {
  console.log(
    'pre-implement hook: no brief found for issue ' + (issue || '<unknown>') + '. ' +
    'Looked at .agent-squad/brief.md and briefs/<issue>.md. ' +
    'Ask Lead to write the brief, then retry.'
  );
  process.exit(1);
}

const briefText = fs.readFileSync(briefPath, 'utf8');
const briefFm = parseFrontmatter(briefText) || {};

// Testable check: look for "## Testable Check" section, non-empty
const tcMatch = briefText.match(/##\s*Testable Check\s*\r?\n([\s\S]*?)(?:\r?\n##|$)/i);
const testableCheck = tcMatch ? tcMatch[1].trim() : '';
if (!testableCheck) {
  console.log(
    'pre-implement hook: brief at ' + briefPath + ' has no "## Testable Check" section, ' +
    'or it is empty. The brief is not implementable as written.'
  );
  process.exit(1);
}

// 1b. Estimate (if present) must be a valid size class
const VALID_ESTIMATES = ['S', 'M', 'L', 'XL'];
let estimate = null;
if (briefFm.estimate !== undefined && briefFm.estimate !== null) {
  estimate = String(briefFm.estimate).trim().toUpperCase();
  if (!VALID_ESTIMATES.includes(estimate)) {
    console.log(
      'pre-implement hook: brief at ' + briefPath + ' has invalid estimate "' + briefFm.estimate + '". ' +
      'Valid values: ' + VALID_ESTIMATES.join(', ') + ' (see contract/brief-format.md).'
    );
    process.exit(1);
  }
}

// 2. Contract (if flagged) must exist in default branch
if (briefFm.contract) {
  const branchToCheck = defaultBranch();
  const r = tryGit(['cat-file', '-e', branchToCheck + ':' + briefFm.contract]);
  if (!r.ok) {
    console.log(
      'pre-implement hook: brief references contract "' + briefFm.contract + '" ' +
      'but it is not present in ' + branchToCheck + '. ' +
      'Architect must merge the contract before Implementer starts (contract-first rule).'
    );
    process.exit(1);
  }
}

// 3. Resolve role from AGENTS.md
const rr = readRoleFromAgentsFile(role);
if (rr.error) {
  console.log('pre-implement hook: ' + rr.error);
  process.exit(1);
}
const resolved = rr.role;

if (resolved.persona !== 'implementer') {
  console.log(
    'pre-implement hook: role "' + role + '" has persona "' + resolved.persona + '", ' +
    'not "implementer". This hook is only for Implementer roles.'
  );
  process.exit(1);
}

// 4. Write session marker
// Model hint: role-level override wins, else the persona frontmatter default.
const model = (resolved.model && MODEL_VALUES.includes(resolved.model))
  ? resolved.model
  : personaDefaultModel(resolved.persona);

const marker = {
  construct_version: payload.construct_version || '0.1.0',
  role: resolved.name,
  issue: issue || null,
  persona: resolved.persona,
  skills: resolved.skills || [],
  write_lanes: (resolved.lanes && resolved.lanes.write) || [],
  read_lanes: (resolved.lanes && resolved.lanes.read) || []
};
if (model) marker.model = model;
if (estimate) marker.estimate = estimate;

const markerDir = path.resolve(process.cwd(), '.agent-squad');
if (!fs.existsSync(markerDir)) fs.mkdirSync(markerDir, { recursive: true });
const markerPath = path.join(markerDir, 'session.yml');
fs.writeFileSync(markerPath, yaml.dump(marker));

console.error('[check-brief-and-contract] OK: brief=' + briefPath + ', role=' + resolved.name + ', persona=' + resolved.persona + ', lanes=' + marker.write_lanes.join(','));
process.exit(0);
