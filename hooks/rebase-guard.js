#!/usr/bin/env node
// rebase-guard hook
// ----------------------------------------------------------------------------
// Built-in agent-squad hook. Auto-rebases the current feature branch onto
// the project's default branch before each commit, surfacing conflicts to the
// Implementer instead of letting them accumulate at PR time.
//
// Configuration (in project's .ai-dlc.yml):
//
//   hooks:
//     rebase_guard: enabled | warn | disabled
//
// Modes:
//   enabled  — block commit on rebase failure, exit 1
//   warn     — print warning, exit 0
//   disabled — skip entirely
//
// Migration note: this file will be populated in the v0.4 board-manager →
// agent-squad port. Source of truth currently lives in:
//   ai-dlc-board-manager/bin/rebase-guard.js
// ----------------------------------------------------------------------------

'use strict';

// Stub — port pending. See migration note above.

const event = JSON.parse(require('fs').readFileSync(0, 'utf-8') || '{}');
process.stderr.write(
  `[rebase-guard] stub — v0.4 migration pending. event=${event.event || 'unknown'}\n`
);
process.exit(0);
