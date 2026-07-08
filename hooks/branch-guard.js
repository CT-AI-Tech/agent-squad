#!/usr/bin/env node
// branch-guard - tool hook (PreToolUse:Write, PreToolUse:Edit)
// Two responsibilities:
//   1. Block edits on protected branches (default: main, master).
//   2. Enforce lane discipline when .agent-squad/session.yml is present.
// Configuration: hooks.branch_guard in .ai-dlc.yml (enabled|warn|disabled).
// Exit codes: 0 allow, 2 block (Claude Code: stdout shown to agent).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readHookMode, readSessionMarker } = require('./lib/session-marker');

const isWin = process.platform === 'win32';
const PROTECTED_BRANCHES = ['main', 'master'];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function tryGit(args) {
  const r = spawnSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'], shell: isWin });
  if (r.status !== 0) return null;
  return r.stdout.toString().trim();
}

function globMatch(pattern, filePath) {
  filePath = filePath.replace(/\\/g, '/');
  pattern = pattern.replace(/\\/g, '/');
  if (pattern.endsWith('/')) {
    const prefix = pattern.replace(/\/$/, '');
    return filePath === prefix || filePath.startsWith(prefix + '/');
  }
  let re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*');
  return new RegExp('^' + re + '$').test(filePath);
}

const mode = readHookMode('branch_guard');
if (mode === 'disabled') process.exit(0);

let payload = {};
try { payload = JSON.parse(readStdin() || '{}'); } catch {}
const filePath =
  (payload.tool_input && (payload.tool_input.file_path || payload.tool_input.path)) || '';

if (tryGit(['rev-parse', '--git-dir']) === null) process.exit(0);

const repoRoot = tryGit(['rev-parse', '--show-toplevel']);
if (filePath && repoRoot) {
  const absFile = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const relToRepo = path.relative(repoRoot, absFile);
  if (relToRepo.startsWith('..') || path.isAbsolute(relToRepo)) process.exit(0);
}

const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);

if (PROTECTED_BRANCHES.includes(branch)) {
  const msg =
    "You are on the '" + branch + "' branch. Never commit implementation work directly to " + branch + ". " +
    "Check out a feature branch first.";
  if (mode === 'warn') { console.error('[branch-guard:warn] ' + msg); process.exit(0); }
  console.log(msg);
  process.exit(2);
}

if (filePath) {
  const session = readSessionMarker();
  if (session && session.role && Array.isArray(session.write_lanes) && session.write_lanes.length > 0) {
    const root = repoRoot || process.cwd();
    const absFile = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const relFile = path.relative(root, absFile).replace(/\\/g, '/');
    const inLane = session.write_lanes.some(g => globMatch(g, relFile));
    if (!inLane) {
      const msg =
        'File "' + relFile + '" is outside the write lane for role "' + session.role + '". ' +
        'Allowed: ' + session.write_lanes.join(', ') + '. ' +
        'Halt and ask Lead to widen the lane in AGENTS.md, or split the work.';
      if (mode === 'warn') { console.error('[branch-guard:warn] ' + msg); process.exit(0); }
      console.log(msg);
      process.exit(2);
    }
  }
}

process.exit(0);
