#!/usr/bin/env node
// move-to-pr-review - post-pr lifecycle hook
//
// Fires after the PR is opened. Two responsibilities:
//   1. Detect board-manager integration (.ai-dlc.yml github_repo + plan_file).
//      When present, signal the column transition to be performed by the
//      board-manager skill that called us. (This hook does not call gh/git
//      itself - it just emits a structured "do this next" line on stdout.)
//   2. Stale the active-role session marker so the next session starts clean.
//
// Exit codes:
//   0 - pass (always, this is post-pr; failures here should not roll back the PR)
//   2 - warn (continue, with notice)
'use strict';

const fs = require('fs');
const path = require('path');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function hasBoardManagerConfig() {
  const p = path.resolve(process.cwd(), '.ai-dlc.yml');
  if (!fs.existsSync(p)) return false;
  try {
    const text = fs.readFileSync(p, 'utf8');
    // Heuristic: github_repo (board-manager-specific) is present and non-empty
    return /^\s*github_repo\s*:\s*\S+/m.test(text);
  } catch { return false; }
}

function archiveSessionMarker() {
  const dir = path.resolve(process.cwd(), '.agent-squad');
  const live = path.join(dir, 'session.yml');
  if (!fs.existsSync(live)) return false;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const archive = path.join(dir, 'session.' + ts + '.yml');
    fs.renameSync(live, archive);
    // Keep a soft history; prune to the last 10 archives so the dir doesn't grow forever
    const archives = fs.readdirSync(dir)
      .filter(f => /^session\.\d{4}-/.test(f))
      .sort();
    while (archives.length > 10) {
      try { fs.unlinkSync(path.join(dir, archives.shift())); } catch {}
    }
    return true;
  } catch { return false; }
}

// Sum the usage ledger for an issue. Returns totals object or null.
function usageTotalsForIssue(issue) {
  try {
    const p = path.resolve(process.cwd(), '.agent-squad', 'usage.json');
    if (!fs.existsSync(p)) return null;
    const ledger = JSON.parse(fs.readFileSync(p, 'utf8'));
    const entry = ledger && ledger.issues && ledger.issues[String(issue)];
    if (!entry || !entry.sessions) return null;
    const totals = { input: 0, output: 0, cache_read: 0, cache_create: 0 };
    for (const s of Object.values(entry.sessions)) {
      if (!s || typeof s !== 'object') continue;
      totals.input += s.input || 0;
      totals.output += s.output || 0;
      totals.cache_read += s.cache_read || 0;
      totals.cache_create += s.cache_create || 0;
    }
    return totals;
  } catch { return null; }
}

// ─── main ────────────────────────────────────────────────────────────────
let payload;
try { payload = JSON.parse(readStdin() || '{}'); } catch { payload = {}; }

const issue = payload.issue_number || payload.issue || null;
const prUrl = payload.pr_url || null;

// Read the marker BEFORE archiving it - the estimate rides on it.
let estimate = null;
try {
  const { readSessionMarker } = require(path.join(__dirname, '..', '..', '..', 'hooks', 'lib', 'session-marker.js'));
  const marker = readSessionMarker();
  if (marker && marker.estimate) estimate = marker.estimate;
} catch {}

const archived = archiveSessionMarker();

const boardWired = hasBoardManagerConfig();

if (boardWired && issue) {
  // Emit a structured next-step for the calling skill to act on.
  // The skill (finish-feature) reads this from stdout and invokes the
  // board-manager move_issue_status operation in its own process.
  console.log('NEXT_STEP move_issue_status issue=' + issue + ' to=pr_review');
} else if (!boardWired) {
  console.error('[move-to-pr-review] no board-manager configured (.ai-dlc.yml has no github_repo); skipping issue transition.');
}

if (issue) {
  const totals = usageTotalsForIssue(issue);
  if (totals) {
    let line = 'USAGE_TOTAL issue=' + issue +
      ' input=' + totals.input + ' output=' + totals.output +
      ' cache_read=' + totals.cache_read + ' cache_create=' + totals.cache_create;
    if (estimate) line += ' estimate=' + estimate;
    console.log(line);
  }
}

if (archived) {
  console.error('[move-to-pr-review] session marker archived.');
}

if (prUrl) {
  console.error('[move-to-pr-review] PR: ' + prUrl);
}

process.exit(0);
