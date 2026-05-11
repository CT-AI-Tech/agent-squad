#!/usr/bin/env node
// rebase-guard - tool hook (PreToolUse:Bash)
// Detects `git commit` invocations and rebases the feature branch onto
// origin/main first, so conflicts surface at commit time rather than at PR time.
// Configuration: hooks.rebase_guard in .ai-dlc.yml (enabled|warn|disabled).
// Exit codes: 0 allow, 2 block.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function tryGit(args, opts) {
  opts = opts || {};
  const r = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    ...opts
  });
  return { ok: r.status === 0, stdout: (r.stdout || '').toString(), stderr: (r.stderr || '').toString() };
}

function runGit(args) {
  const r = spawnSync('git', args, { stdio: ['ignore', 'inherit', 'inherit'], shell: isWin });
  return r.status === 0;
}

function readHookMode(key) {
  const candidates = [
    path.resolve(process.cwd(), '.ai-dlc.yml'),
    process.env.AI_DLC_CONFIG ? path.resolve(process.env.AI_DLC_CONFIG) : null
  ].filter(Boolean);
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const text = fs.readFileSync(p, 'utf8');
      const lines = text.split(/\r?\n/);
      let inHooks = false;
      for (const raw of lines) {
        const line = raw.replace(/#.*$/, '');
        if (/^hooks\s*:/.test(line)) { inHooks = true; continue; }
        if (inHooks) {
          if (/^\S/.test(line) && line.trim() !== '') break;
          const m = line.match(new RegExp('^\\s+' + key + '\\s*:\\s*(\\w+)'));
          if (m) return m[1].toLowerCase();
        }
      }
    } catch {}
  }
  return 'enabled';
}

// Detect the project default branch. Tries origin/HEAD first, falls back to "main".
// v0.2: consider reading from .ai-dlc.yml default_branch override.
function detectDefaultBranch() {
  const r = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (r.ok && r.stdout.trim()) {
    return r.stdout.trim().replace(/^origin\//, '');
  }
  return 'main';
}

const hookMode = readHookMode('rebase_guard');
if (hookMode === 'disabled') process.exit(0);

let payload;
try { payload = JSON.parse(readStdin() || '{}'); } catch { process.exit(0); }
const command = (payload && payload.tool_input && payload.tool_input.command) || '';

// Only act on `git commit` (handles `git commit ...`, `&& git commit`, `; git commit`)
if (!/(^|\s|&&|;)\s*git\s+commit\b/.test(command)) process.exit(0);

if (hookMode === 'warn') {
  console.error('[rebase-guard:warn] hooks.rebase_guard set to warn - skipping rebase.');
  process.exit(0);
}

if (!tryGit(['rev-parse', '--git-dir']).ok) process.exit(0);

const defaultBranch = detectDefaultBranch();
const upstream = 'origin/' + defaultBranch;

if (!tryGit(['ls-remote', '--exit-code', 'origin', defaultBranch]).ok) process.exit(0);

const branchRes = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
const branch = branchRes.ok ? branchRes.stdout.trim() : '';
if (branch === defaultBranch || branch === 'master') process.exit(0);

console.error('[rebase-guard] Rebasing from ' + upstream + ' before commit...');

runGit(['fetch', 'origin', defaultBranch]);

const hasUnstaged = !tryGit(['diff', '--quiet']).ok;
const hasStaged = !tryGit(['diff', '--cached', '--quiet']).ok;
const hasChanges = hasUnstaged || hasStaged;

if (hasChanges) {
  console.error('[rebase-guard] Stashing pending changes for rebase...');
  if (!runGit(['stash', 'push', '-m', 'rebase-guard:auto'])) {
    console.log('rebase-guard: could not stash your pending changes before rebasing. ' +
                'Stash or commit them manually and retry.');
    process.exit(2);
  }
}

const rebased = runGit(['rebase', upstream]);

if (hasChanges) {
  if (!runGit(['stash', 'pop', '--index'])) {
    console.log('rebase-guard: ' + (rebased ? 'rebase succeeded' : 'rebase failed') +
                ', but reapplying your stashed changes hit a conflict. The stash is ' +
                'preserved (see `git stash list`). Resolve the conflicts in your ' +
                'working tree, run `git stash drop` once clean, then retry the commit.');
    process.exit(2);
  }
}

if (!rebased) {
  console.log('Rebase from ' + upstream + ' failed - there are conflicts to resolve before committing. ' +
              "Fix the conflicts, run 'git rebase --continue', then retry the commit.");
  process.exit(2);
}

console.error('[rebase-guard] Rebase complete.');
process.exit(0);
