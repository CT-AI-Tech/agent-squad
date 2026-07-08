#!/usr/bin/env node
// validate-self-review - pre-pr lifecycle hook
//
// Validates the PR body's self-review block against contract/self-review-format.md.
// Rules differ per active persona (lead/architect/implementer), read from session.yml.
//
// Body source: prefers payload.pr_body, falls back to .agent-squad/pr-body.md.
//
// Exit codes:
//   0 - pass
//   1 - block (validation errors printed to stdout)
//   2 - warn (continue with warnings)
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let yaml;
try { yaml = require('js-yaml'); }
catch { yaml = null; }

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function tryGit(args) {
  const r = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32'
  });
  if (r.status !== 0) return null;
  return r.stdout.toString().trim();
}

function readSessionMarker() {
  const p = path.resolve(process.cwd(), '.agent-squad', 'session.yml');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  if (yaml) {
    try { return yaml.load(text); } catch { return null; }
  }
  // Fallback (mirror branch-guard hand-parser)
  const out = { write_lanes: [], read_lanes: [], skills: [] };
  const lines = text.split(/\r?\n/);
  let listKey = null;
  let listIndent = -1;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').replace(/\r$/, '');
    if (line.trim() === '') continue;
    if (listKey) {
      const itemM = line.match(/^(\s+)-\s*(.+?)\s*$/);
      if (itemM && itemM[1].length > listIndent) {
        out[listKey].push(itemM[2].replace(/^["']|["']$/g, ''));
        continue;
      } else { listKey = null; listIndent = -1; }
    }
    const m = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (m) {
      const k = m[1]; const v = m[2].trim();
      if (v === '') {
        if (['write_lanes', 'read_lanes', 'skills'].includes(k)) {
          listKey = k;
          listIndent = (line.match(/^(\s*)/)[1] || '').length;
        }
      } else { out[k] = v.replace(/^["']|["']$/g, ''); }
    }
  }
  return out;
}

function loadPrBody(payload) {
  if (payload && payload.pr_body && typeof payload.pr_body === 'string') {
    return payload.pr_body;
  }
  const p = path.resolve(process.cwd(), '.agent-squad', 'pr-body.md');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  return null;
}

function gitDiffFiles() {
  const out = tryGit(['diff', '--name-only', 'HEAD']);
  if (!out) return [];
  // Also include uncommitted staged changes
  const staged = tryGit(['diff', '--name-only', '--cached']) || '';
  const all = (out + '\n' + staged).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(all));
}

function findPlaceholders(text) {
  const placeholders = [];
  // Match <...> placeholders (but skip HTML-ish things like <br>, <code>, etc.)
  const re = /<[^<>\n]+>/g;
  // Known HTML tags, anchored by a boundary (whitespace, slash, or end) so that
  // prose-y placeholders like <paste the testable check here> do not match the
  // single-letter "p" alternation.
  const HTML_TAG = /^\/?(br|hr|p|a|b|i|s|u|em|strong|code|pre|kbd|sup|sub|del|small|h[1-6]|div|span|ul|ol|li|table|tr|td|th|img|input|button|form|label|select|option|textarea)(\s|\/|$)/i;
  let m;
  while ((m = re.exec(text)) !== null) {
    const inside = m[0].slice(1, -1);
    if (/^!--/.test(inside)) continue;
    if (HTML_TAG.test(inside)) continue;
    if (/^@/.test(inside)) continue;
    placeholders.push(m[0]);
  }
  return placeholders;
}

function countBullets(sectionText) {
  return (sectionText.match(/^\s*[-*]\s+\S/gm) || []).length;
}

function countSteps(sectionText) {
  // Bullets or numbered items ("- x", "* x", "1. x", "1) x")
  return (sectionText.match(/^\s*(?:[-*]|\d+[.)])\s+\S/gm) || []).length;
}

function hasCommandLine(sectionText) {
  // A fenced code block or a "$ "-prefixed shell line counts as a command
  return /```/.test(sectionText) || /^\s*\$\s+\S/m.test(sectionText);
}

function extractSection(body, headerRegex) {
  // Find header line, then capture until next header of same or higher level
  const lines = body.split(/\r?\n/);
  let startIdx = -1;
  let headerLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+(.+?)\s*$/);
    if (m && headerRegex.test(lines[i])) {
      startIdx = i;
      headerLevel = m[1].length;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+/);
    if (m && m[1].length <= headerLevel) { endIdx = i; break; }
  }
  return lines.slice(startIdx + 1, endIdx).join('\n').trim();
}

function validateImplementer(body, role, diffFiles) {
  const errors = [];
  // Agent Brief section
  const briefSec = extractSection(body, /^##\s+Agent Brief\s*$/i);
  if (!briefSec) errors.push('missing "## Agent Brief" section (paste testable check verbatim)');
  else if (briefSec.length < 10) errors.push('"## Agent Brief" section is too short (must contain pasted testable check)');

  // Agent self-review header
  const selfReviewRe = new RegExp('^##\\s+Agent self-review\\s+[—-]\\s+' + role + '\\s*$', 'im');
  if (!selfReviewRe.test(body)) {
    errors.push('missing "## Agent self-review — ' + role + '" header (role from session.yml)');
  }

  // What I actively checked
  const checked = extractSection(body, /^###\s+What I actively checked\b/i);
  if (checked === null) errors.push('missing "### What I actively checked" section');
  else if (countBullets(checked) < 3) errors.push('"### What I actively checked" must list at least 3 items (found ' + countBullets(checked) + ')');

  // Testable Check verification
  const tcv = extractSection(body, /^###\s+Testable Check verification\b/i);
  if (tcv === null) errors.push('missing "### Testable Check verification" section');
  else {
    if (!/Command run\s*:/i.test(tcv)) errors.push('"### Testable Check verification" missing "Command run:" line');
    if (!/Output/i.test(tcv)) errors.push('"### Testable Check verification" missing "Output" line');
    if (!/Result\s*:/i.test(tcv)) errors.push('"### Testable Check verification" missing "Result:" line');
  }

  // How to test (reviewer-facing reproduction steps)
  const howTo = extractSection(body, /^###\s+How to test\b/i);
  if (howTo === null) errors.push('missing "### How to test" section (reviewer reproduction steps)');
  else if (countSteps(howTo) < 2 && !hasCommandLine(howTo)) {
    errors.push('"### How to test" must contain at least 2 steps or 1 command line');
  }

  // Files changed
  const filesSec = extractSection(body, /^###\s+Files changed\b/i);
  if (filesSec === null) errors.push('missing "### Files changed" section');
  else {
    const listed = (filesSec.match(/^[-*]\s+([^\s:]+)/gm) || []).map(s => s.replace(/^[-*]\s+/, '').trim());
    if (diffFiles.length > 0) {
      const missing = diffFiles.filter(f => !listed.some(l => l === f || l.startsWith(f) || f.startsWith(l)));
      if (missing.length > 0) {
        errors.push('"### Files changed" does not list: ' + missing.join(', '));
      }
    }
  }

  // Tests written or updated
  const tests = extractSection(body, /^###\s+Tests written or updated\b/i);
  if (tests === null) errors.push('missing "### Tests written or updated" section');
  else if (tests.length < 5) errors.push('"### Tests written or updated" must be non-empty');

  // Issues I found section header (may be empty list)
  if (!/^###\s+Issues I found and chose not to fix\b/im.test(body)) {
    errors.push('missing "### Issues I found and chose not to fix in this PR" header');
  }

  return errors;
}

function validateArchitect(body, role) {
  const errors = [];
  const selfReviewRe = new RegExp('^##\\s+Agent self-review\\s+[—-]\\s+' + role + '\\s*$', 'im');
  if (!selfReviewRe.test(body)) {
    errors.push('missing "## Agent self-review — ' + role + '" header');
  }
  const tradeoffs = extractSection(body, /^###\s+Trade-?offs considered\b/i);
  if (tradeoffs === null) errors.push('missing "### Trade-offs considered" section');
  else if (countBullets(tradeoffs) < 1) errors.push('"### Trade-offs considered" must list at least 1 item');

  const alts = extractSection(body, /^###\s+Alternatives explicitly rejected\b/i);
  if (alts === null) errors.push('missing "### Alternatives explicitly rejected" section');
  else if (countBullets(alts) < 1) errors.push('"### Alternatives explicitly rejected" must list at least 1 item');

  const downstream = extractSection(body, /^###\s+Downstream impact\b/i);
  if (downstream === null) errors.push('missing "### Downstream impact" section');
  else if (downstream.length < 5) errors.push('"### Downstream impact" must be non-empty');

  if (!/^###\s+Open questions for Lead\b/im.test(body)) {
    errors.push('missing "### Open questions for Lead" header');
  }
  return errors;
}

function validateLead(body) {
  const errors = [];
  if (!/^##\s+Agent self-review\s+[—-]\s+lead\s*$/im.test(body)) {
    errors.push('missing "## Agent self-review — lead" header');
  }
  const fields = ['Decision', 'Inputs considered', 'Affected roles', 'Migration', 'Reversibility'];
  for (const f of fields) {
    const re = new RegExp('^' + f.replace(/ /g, '\\s+') + '\\s*:\\s*(\\S.*)$', 'im');
    const m = body.match(re);
    if (!m) errors.push('missing or empty "' + f + ':" line');
  }
  const rev = body.match(/^Reversibility\s*:\s*(.+?)\s*$/im);
  if (rev) {
    const v = rev[1].trim().toLowerCase();
    if (!['reversible', 'one-way', 'conditionally reversible'].includes(v)) {
      errors.push('"Reversibility:" must be one of: reversible, one-way, conditionally reversible (got "' + rev[1].trim() + '")');
    }
  }
  return errors;
}

// ─── main ────────────────────────────────────────────────────────────────
let payload;
try { payload = JSON.parse(readStdin() || '{}'); } catch { payload = {}; }

const body = loadPrBody(payload);
if (!body) {
  console.log('pre-pr hook: PR body not found. Provide it in payload.pr_body or write it to .agent-squad/pr-body.md before invoking finish-feature.');
  process.exit(1);
}

const session = readSessionMarker();
if (!session || !session.role || !session.persona) {
  console.log('pre-pr hook: .agent-squad/session.yml is missing or incomplete. Run pre-implement first or set up the marker manually.');
  process.exit(1);
}

const role = session.role;
const persona = session.persona;
const diffFiles = payload.diff && Array.isArray(payload.diff.files_changed)
  ? payload.diff.files_changed
  : gitDiffFiles();

let errors = [];
if (persona === 'implementer') errors = validateImplementer(body, role, diffFiles);
else if (persona === 'architect') errors = validateArchitect(body, role);
else if (persona === 'lead') errors = validateLead(body);
else {
  console.log('pre-pr hook: unknown persona "' + persona + '" in session.yml');
  process.exit(1);
}

// Placeholder check (applies to all personas)
const placeholders = findPlaceholders(body);
if (placeholders.length > 0) {
  errors.push('placeholder strings remain (replace before submitting): ' + placeholders.slice(0, 5).join(', ') +
              (placeholders.length > 5 ? ' ...' : ''));
}

if (errors.length > 0) {
  console.log('Self-review validation failed for role "' + role + '" (persona: ' + persona + '):');
  for (const e of errors) console.log('  - ' + e);
  console.log('\nSee contract/self-review-format.md for the required format.');
  process.exit(1);
}

console.error('[validate-self-review] OK: persona=' + persona + ', role=' + role + ', sections complete.');
process.exit(0);
