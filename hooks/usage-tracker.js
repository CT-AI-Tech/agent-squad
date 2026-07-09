#!/usr/bin/env node
// usage-tracker - tool hook (Stop, Claude Code specific)
// Records actual token usage per feature. On every Stop event, if an
// agent-squad session marker with an issue is active, parses the session
// transcript (JSONL) plus every spawned-subagent transcript under
// <session>/subagents/ and writes cumulative totals into the per-issue ledger
// at .agent-squad/usage.json. The main session and each subagent get their own
// ledger entry, overwritten with fresh totals each Stop so repeated Stop events
// never double-count. Summing the subagents is what makes the feature total
// cover orchestrated dispatch, where the squad agents do the bulk of the work.
// Configuration: hooks.usage_tracker in .ai-dlc.yml (enabled|warn|disabled).
// Exit codes: 0 always (informational hook; never blocks).
'use strict';

const fs = require('fs');
const path = require('path');
const { readHookMode, readSessionMarker } = require('./lib/session-marker');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Sum usage across all assistant messages in a transcript file. Each line is
// an independent JSON object; unparseable lines are skipped. Returns null when
// the file cannot be read.
function sumTranscript(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const t = { input: 0, output: 0, cache_read: 0, cache_create: 0 };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const msg = obj && obj.message;
    const isAssistant = obj && (obj.type === 'assistant' || (msg && msg.role === 'assistant'));
    if (!isAssistant || !msg || !msg.usage) continue;
    const u = msg.usage;
    t.input += u.input_tokens || 0;
    t.output += u.output_tokens || 0;
    t.cache_read += u.cache_read_input_tokens || 0;
    t.cache_create += u.cache_creation_input_tokens || 0;
  }
  return t;
}

try {
  const mode = readHookMode('usage_tracker');
  if (mode === 'disabled') process.exit(0);

  let payload = {};
  try { payload = JSON.parse(readStdin() || '{}'); } catch {}
  const sessionId = payload.session_id;
  const transcriptPath = payload.transcript_path;
  if (!sessionId || !transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  const marker = readSessionMarker();
  if (!marker || !marker.issue) process.exit(0);
  const issue = String(marker.issue);

  const totals = sumTranscript(transcriptPath) ||
    { input: 0, output: 0, cache_read: 0, cache_create: 0 };

  const dir = path.resolve(process.cwd(), '.agent-squad');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ledgerPath = path.join(dir, 'usage.json');

  let ledger = {};
  try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch {}
  if (!ledger || typeof ledger !== 'object') ledger = {};
  if (!ledger.issues || typeof ledger.issues !== 'object') ledger.issues = {};
  if (!ledger.issues[issue] || typeof ledger.issues[issue] !== 'object') ledger.issues[issue] = {};
  if (!ledger.issues[issue].sessions || typeof ledger.issues[issue].sessions !== 'object') {
    ledger.issues[issue].sessions = {};
  }
  ledger.issues[issue].sessions[sessionId] = totals;

  // Claude Code stores each spawned subagent's turns in a sibling transcript
  // under <session>/subagents/<agent-id>.jsonl, NOT in the main session
  // transcript above. In orchestrated dispatch the squad agents do the bulk of
  // the work, so their tokens must be summed too or the feature total reflects
  // only the orchestrator's own overhead. Record each under its own key (the
  // agent id is globally unique) so repeated Stops overwrite idempotently and
  // move-to-pr-review's sum-over-sessions picks them up.
  const subDir = path.join(transcriptPath.replace(/\.jsonl$/i, ''), 'subagents');
  let subFiles = [];
  try { subFiles = fs.readdirSync(subDir).filter(f => /\.jsonl$/i.test(f)); } catch {}
  for (const f of subFiles) {
    const sub = sumTranscript(path.join(subDir, f));
    if (sub) ledger.issues[issue].sessions[f.replace(/\.jsonl$/i, '')] = sub;
  }

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
} catch {}
process.exit(0);
