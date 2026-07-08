#!/usr/bin/env node
// squad-session - session marker CLI
// ----------------------------------------------------------------------------
// Lets ANY persona hold the active-role marker (.agent-squad/session.yml).
// The implementer flow writes the marker automatically via the pre-implement
// hook; Lead and Architect flows use this CLI when they activate.
//
// Usage (run from the consumer project root, where AGENTS.md lives):
//   node <plugin-root>/bin/squad-session.js set <role-name> [--issue N]
//   node <plugin-root>/bin/squad-session.js clear
//
// Exit codes:
//   0 - success
//   1 - validation failure (unknown role, missing AGENTS.md, ...)
//   2 - invocation error
// ----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('squad-session: js-yaml is required. Run `npm install` in the agent-squad directory.');
  process.exit(2);
}

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const MODEL_VALUES = ['opus', 'sonnet', 'haiku', 'inherit'];

function constructVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(
      path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    if (pkg.version) return pkg.version;
  } catch {}
  return '0.3.0';
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  try { return yaml.load(m[1]); } catch { return null; }
}

function personaDefaultModel(persona) {
  const p = path.join(PLUGIN_ROOT, 'personas', persona + '.md');
  if (!fs.existsSync(p)) return null;
  const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
  if (fm && fm.model && MODEL_VALUES.includes(fm.model)) return fm.model;
  return null;
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

const markerPath = path.resolve(process.cwd(), '.agent-squad', 'session.yml');
const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'clear') {
  if (fs.existsSync(markerPath)) {
    fs.unlinkSync(markerPath);
    console.log('[squad-session] cleared ' + markerPath);
  } else {
    console.log('[squad-session] no active session marker.');
  }
  process.exit(0);
}

if (cmd !== 'set' || !args[1]) {
  console.error('Usage: squad-session set <role-name> [--issue N] | squad-session clear');
  process.exit(2);
}

const roleName = args[1];
let issue = null;
const issueIdx = args.indexOf('--issue');
if (issueIdx !== -1) {
  issue = args[issueIdx + 1];
  if (!issue) {
    console.error('squad-session: --issue requires a value');
    process.exit(2);
  }
}

const rr = readRoleFromAgentsFile(roleName);
if (rr.error) {
  console.error('squad-session: ' + rr.error);
  process.exit(1);
}
const resolved = rr.role;

if (resolved.model && !MODEL_VALUES.includes(resolved.model)) {
  console.error('squad-session: role "' + roleName + '" has invalid model "' + resolved.model +
    '". Valid: ' + MODEL_VALUES.join(', '));
  process.exit(1);
}

const model = resolved.model || personaDefaultModel(resolved.persona);

const marker = {
  construct_version: constructVersion(),
  role: resolved.name,
  persona: resolved.persona,
  skills: resolved.skills || [],
  write_lanes: (resolved.lanes && resolved.lanes.write) || [],
  read_lanes: (resolved.lanes && resolved.lanes.read) || []
};
if (issue) marker.issue = issue;
if (model) marker.model = model;

const markerDir = path.dirname(markerPath);
if (!fs.existsSync(markerDir)) fs.mkdirSync(markerDir, { recursive: true });
fs.writeFileSync(markerPath, yaml.dump(marker));

console.log('[squad-session] active: persona=' + resolved.persona + ' role=' + resolved.name +
  (issue ? ' issue=#' + issue : '') + (model ? ' model=' + model : ''));
process.exit(0);
