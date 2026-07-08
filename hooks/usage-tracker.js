#!/usr/bin/env node
// usage-tracker - tool hook (Stop, Claude Code specific)
// Records actual token usage per feature. On every Stop event, if an
// agent-squad session marker with an issue is active, parses the session
// transcript (JSONL) and writes cumulative totals for this session into the
// per-issue ledger at .agent-squad/usage.json. Overwrites the session entry
// with fresh totals each time, so repeated Stop events never double-count.
// Configuration: hooks.usage_tracker in .ai-dlc.yml (enabled|warn|disabled).
// Exit codes: 0 always (informational hook; never blocks).
'use strict';

const fs = require('fs');
const path = require('path');
const { readHookMode, readSessionMarker } = require('./lib/session-marker');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
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

  // Sum usage across all assistant messages in the transcript. Each line is
  // an independent JSON object; unparseable lines are skipped.
  const totals = { input: 0, output: 0, cache_read: 0, cache_create: 0 };
  const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const msg = obj && obj.message;
    const isAssistant = obj && (obj.type === 'assistant' || (msg && msg.role === 'assistant'));
    if (!isAssistant || !msg || !msg.usage) continue;
    const u = msg.usage;
    totals.input += u.input_tokens || 0;
    totals.output += u.output_tokens || 0;
    totals.cache_read += u.cache_read_input_tokens || 0;
    totals.cache_create += u.cache_creation_input_tokens || 0;
  }

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

  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
} catch {}
process.exit(0);
