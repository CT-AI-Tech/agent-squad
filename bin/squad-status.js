#!/usr/bin/env node
// squad-status - statusline helper (not a hook)
// Prints a one-line summary of the active agent-squad role for use as a
// Claude Code statusLine command:
//   "statusLine": { "type": "command",
//                   "command": "node <plugin-root>/bin/squad-status.js" }
// Prints nothing (exit 0) when no session marker exists, so the statusline
// stays empty outside agent-squad work.
'use strict';

const { readSessionMarker } = require('../hooks/lib/session-marker');

const marker = readSessionMarker();
if (!marker || !marker.persona || !marker.role) process.exit(0);

let line = '[agent-squad] ' + marker.persona + ':' + marker.role;
if (marker.issue) line += ' #' + marker.issue;
if (marker.model) line += ' (' + marker.model + ')';
console.log(line);
process.exit(0);
