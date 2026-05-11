#!/usr/bin/env node
// branch-guard hook
// ----------------------------------------------------------------------------
// Built-in agent-squad hook. Two responsibilities:
//
//   1. Block edits on protected branches (default: main, master).
//   2. Enforce lane discipline at commit time — files changed must match the
//      current role's `write` lane glob list (declared in project AGENTS.md).
//
// Configuration (in project's .ai-dlc.yml):
//
//   hooks:
//     branch_guard: enabled | warn | disabled
//
// Modes:
//   enabled  — block on violation, exit 1
//   warn     — print warning, exit 0
//   disabled — skip entirely
//
// Migration note: this file will be populated in the v0.4 board-manager →
// agent-squad port. Source of truth currently lives in:
//   ai-dlc-board-manager/bin/branch-guard.js
//
// During v0.4 (copy phase), both copies exist and the board-manager copy
// emits a deprecation warning. v0.5 removes the duplicate and hard-deps on
// agent-squad >= 0.1.
// ----------------------------------------------------------------------------

'use strict';

// Stub — port pending. See migration note above.

const event = JSON.parse(require('fs').readFileSync(0, 'utf-8') || '{}');
process.stderr.write(
  `[branch-guard] stub — v0.4 migration pending. event=${event.event || 'unknown'}\n`
);
process.exit(0);
