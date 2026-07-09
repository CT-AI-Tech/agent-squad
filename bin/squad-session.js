#!/usr/bin/env node
// squad-session - session marker CLI
// ----------------------------------------------------------------------------
// Lets ANY persona hold the active-role marker (.agent-squad/session.yml).
// The implementer flow writes the marker automatically via the pre-implement
// hook; Lead and Architect flows use this CLI when they activate.
//
// Usage (run from the consumer project root, where AGENTS.md lives):
//   node <plugin-root>/bin/squad-session.js set <role-name> [--issue N] [--estimate S|M|L|XL]
//   node <plugin-root>/bin/squad-session.js get [<field>]
//   node <plugin-root>/bin/squad-session.js clear
//
// js-yaml is preferred when installed, but OPTIONAL: this script is shipped
// into consumer projects (scripts/hooks/) that may never run npm install.
// Without js-yaml it falls back to hand-rolled parsing/emitting that covers
// the flat session.yml schema (construct_version, role, persona, skills,
// write_lanes, read_lanes, issue, model) and the conventional AGENTS.md
// role-schema layout.
//
// Exit codes:
//   0 - success
//   1 - validation failure (unknown role, missing AGENTS.md, no marker, ...)
//   2 - invocation error
// ----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

// Optional dependency. AGENT_SQUAD_NO_JS_YAML forces the fallback (used by
// the smoke tests to exercise the no-dependency path deterministically).
let yaml = null;
if (!process.env.AGENT_SQUAD_NO_JS_YAML) {
  try { yaml = require('js-yaml'); } catch { yaml = null; }
}

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const MODEL_VALUES = ['opus', 'sonnet', 'haiku', 'inherit'];
const VALID_ESTIMATES = ['S', 'M', 'L', 'XL'];
const MARKER_LIST_KEYS = ['skills', 'write_lanes', 'read_lanes'];

// --- hand-rolled YAML fallback helpers -------------------------------------

function unquote(s) {
  return String(s).trim().replace(/^["']|["']$/g, '');
}

// "[a, b]" -> ['a', 'b']; returns null when s is not a flow list.
function parseFlowList(s) {
  s = s.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(unquote).filter(x => x !== '');
}

// "{write: [a], read: []}" -> object; returns null when s is not a flow map.
function parseFlowMap(s) {
  s = s.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  const out = {};
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of s.slice(1, -1)) {
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() !== '') parts.push(cur);
  for (const part of parts) {
    const m = part.match(/^\s*(\w+)\s*:\s*([\s\S]*)$/);
    if (!m) return null;
    const v = m[2].trim();
    out[m[1]] = v.startsWith('[') ? (parseFlowList(v) || []) : unquote(v);
  }
  return out;
}

// Flat "key: value" scalars at column 0 (persona frontmatter fallback:
// only top-level scalars like model/name/version are needed).
function fallbackParseFlatScalars(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s#.*$/, '');
    const m = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (m) out[m[1]] = unquote(m[2]);
  }
  return out;
}

// Flat session.yml schema: top-level scalars plus block/flow lists for
// skills / write_lanes / read_lanes. Mirrors hooks/lib/session-marker.js.
function fallbackParseMarker(text) {
  const out = { skills: [], write_lanes: [], read_lanes: [] };
  let listKey = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '');
    if (line.trim() === '') continue;
    if (listKey) {
      const itemM = line.match(/^(\s+)-\s*(.+?)\s*$/);
      if (itemM) { out[listKey].push(unquote(itemM[2])); continue; }
      listKey = null;
    }
    const m = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    const v = m[2].trim();
    if (v === '') {
      if (MARKER_LIST_KEYS.includes(k)) listKey = k;
      continue;
    }
    const fl = parseFlowList(v);
    if (fl) { out[k] = fl; continue; }
    if (v === 'null' || v === '~') continue;
    out[k] = unquote(v);
  }
  return out;
}

// Emit the flat marker schema: scalars, plus string lists as block lists.
function dumpFlatYaml(obj) {
  const lines = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v)) {
      if (v.length === 0) { lines.push(k + ': []'); continue; }
      lines.push(k + ':');
      for (const item of v) lines.push('  - ' + item);
    } else if (v === null || v === undefined) {
      lines.push(k + ': null');
    } else {
      lines.push(k + ': ' + v);
    }
  }
  return lines.join('\n') + '\n';
}

// Best-effort parser for the conventional AGENTS.md role-schema layout:
//   roles:
//     - name: backend-dev
//       persona: implementer
//       skills: [python]           (flow or block list)
//       model: haiku
//       lanes:                     (block map, or flow map {write: [...]})
//         write: [app/, tests/]    (flow or block list)
//         read:
//           - docs/contracts/
// Returns { roles: [...] } or null when no roles block is found.
function fallbackParseRoles(text) {
  const roles = [];
  let inRoles = false;
  let seenRoles = false;
  let role = null;
  let lanes = null;
  let lanesIndent = -1;
  let list = null;
  let listIndent = -1;

  function setRoleKey(key, val, indent) {
    if (val === '') {
      if (key === 'lanes') { role.lanes = {}; lanes = role.lanes; lanesIndent = indent; }
      else { role[key] = []; list = role[key]; listIndent = indent; }
      return;
    }
    const fm = parseFlowMap(val);
    if (fm) { role[key] = fm; return; }
    const fl = parseFlowList(val);
    if (fl) { role[key] = fl; return; }
    role[key] = unquote(val);
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s#.*$/, '');
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();

    if (!inRoles) {
      if (indent === 0 && /^roles\s*:\s*$/.test(trimmed)) { inRoles = true; seenRoles = true; }
      continue;
    }
    if (indent === 0) { inRoles = false; role = null; lanes = null; list = null; continue; }

    const dashM = trimmed.match(/^-\s*(.*)$/);
    if (dashM) {
      const rest = dashM[1];
      const kvM = rest.match(/^(\w+)\s*:\s*(.*)$/);
      if (kvM) {
        // "- key: value" opens a new role map
        role = {};
        roles.push(role);
        lanes = null;
        list = null;
        setRoleKey(kvM[1], kvM[2].trim(), indent + 2);
        continue;
      }
      if (list && indent > listIndent) list.push(unquote(rest));
      continue;
    }

    const kvM = trimmed.match(/^(\w+)\s*:\s*(.*)$/);
    if (!kvM || !role) continue;
    list = null;
    const key = kvM[1];
    const val = kvM[2].trim();
    if (lanes && indent > lanesIndent) {
      if (val === '') { lanes[key] = []; list = lanes[key]; listIndent = indent; }
      else lanes[key] = parseFlowList(val) || [unquote(val)];
      continue;
    }
    lanes = null;
    setRoleKey(key, val, indent);
  }

  return seenRoles ? { roles: roles } : null;
}

// --- shared lookups ---------------------------------------------------------

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
  if (yaml) {
    try { return yaml.load(m[1]); } catch { return null; }
  }
  return fallbackParseFlatScalars(m[1]);
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
  if (yaml) {
    try { doc = yaml.load(m[1]); } catch (e) { return { error: 'AGENTS.md YAML parse failed: ' + e.message }; }
  } else {
    doc = fallbackParseRoles(m[1]);
    if (!doc) return { error: 'AGENTS.md YAML parse failed (js-yaml unavailable; fallback parser found no roles block)' };
  }
  if (!doc || !Array.isArray(doc.roles)) return { error: 'AGENTS.md has no roles list' };
  const role = doc.roles.find(r => r && r.name === roleName);
  if (!role) return { error: 'Role "' + roleName + '" not found in AGENTS.md' };
  return { role: role };
}

// --- commands ---------------------------------------------------------------

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

if (cmd === 'get') {
  if (!fs.existsSync(markerPath)) {
    console.error('[squad-session] no active session marker.');
    process.exit(1);
  }
  const text = fs.readFileSync(markerPath, 'utf8');
  let marker = null;
  if (yaml) {
    try { marker = yaml.load(text); } catch { marker = null; }
  }
  if (!marker || typeof marker !== 'object') marker = fallbackParseMarker(text);
  const field = args[1];
  if (field) {
    if (!(field in marker) || marker[field] === null || marker[field] === undefined) {
      console.error('[squad-session] field "' + field + '" not set in marker.');
      process.exit(1);
    }
    const v = marker[field];
    console.log(Array.isArray(v) ? v.join('\n') : String(v));
  } else {
    console.log(JSON.stringify(marker, null, 2));
  }
  process.exit(0);
}

if (cmd !== 'set' || !args[1]) {
  console.error('Usage: squad-session set <role-name> [--issue N] [--estimate S|M|L|XL] | squad-session get [<field>] | squad-session clear');
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

// --estimate carries the brief's size class (S|M|L|XL) onto the marker so the
// PR-time token note can compare the estimate with recorded actuals. In the
// implementer flow the pre-implement hook copies it from the brief; in
// dispatch (orchestrate) the Lead passes it here from the brief frontmatter.
let estimate = null;
const estIdx = args.indexOf('--estimate');
if (estIdx !== -1) {
  const rawEst = args[estIdx + 1];
  if (!rawEst) {
    console.error('squad-session: --estimate requires a value (S|M|L|XL)');
    process.exit(2);
  }
  estimate = String(rawEst).trim().toUpperCase();
  if (!VALID_ESTIMATES.includes(estimate)) {
    console.error('squad-session: invalid estimate "' + rawEst + '". Valid: ' + VALID_ESTIMATES.join(', '));
    process.exit(1);
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

// Preserve an existing estimate across role switches: sequential dispatch
// re-sets the marker per task, and rebuilding it from the role alone would
// otherwise drop the size class the feature was estimated at. An explicit
// --estimate always wins over the preserved value.
if (!estimate && fs.existsSync(markerPath)) {
  try {
    const prevText = fs.readFileSync(markerPath, 'utf8');
    let prev = null;
    if (yaml) { try { prev = yaml.load(prevText); } catch { prev = null; } }
    if (!prev || typeof prev !== 'object') prev = fallbackParseMarker(prevText);
    const prevEst = prev && prev.estimate ? String(prev.estimate).trim().toUpperCase() : null;
    if (prevEst && VALID_ESTIMATES.includes(prevEst)) estimate = prevEst;
  } catch {}
}

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
if (estimate) marker.estimate = estimate;

const markerDir = path.dirname(markerPath);
if (!fs.existsSync(markerDir)) fs.mkdirSync(markerDir, { recursive: true });
fs.writeFileSync(markerPath, yaml ? yaml.dump(marker) : dumpFlatYaml(marker));

console.log('[squad-session] active: persona=' + resolved.persona + ' role=' + resolved.name +
  (issue ? ' issue=#' + issue : '') + (model ? ' model=' + model : '') +
  (estimate ? ' estimate=' + estimate : '') +
  (yaml ? '' : ' (js-yaml unavailable; used built-in YAML fallback)'));
process.exit(0);
