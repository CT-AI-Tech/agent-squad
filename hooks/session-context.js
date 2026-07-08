#!/usr/bin/env node
// session-context - tool hook (UserPromptSubmit, SessionStart)
// Injects a one-line description of the active agent-squad role into the
// model's context so the agent always knows (and announces) which persona
// it is operating as. Silent no-op when no session marker exists.
// Configuration: hooks.session_context in .ai-dlc.yml (enabled|warn|disabled).
// Exit codes: 0 always (informational hook; never blocks).
'use strict';

const fs = require('fs');
const { readHookMode, readSessionMarker } = require('./lib/session-marker');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const mode = readHookMode('session_context');
if (mode === 'disabled') process.exit(0);

let payload = {};
try { payload = JSON.parse(readStdin() || '{}'); } catch {}
const eventName = payload.hook_event_name === 'SessionStart' ? 'SessionStart' : 'UserPromptSubmit';

const marker = readSessionMarker();
if (!marker || !marker.persona || !marker.role) process.exit(0);

let line = 'Active agent-squad persona: ' + marker.persona + ' (role ' + marker.role;
if (marker.issue) line += ', issue #' + marker.issue;
if (marker.model) line += ', model hint: ' + marker.model;
line += '). Announce persona and role at turn start.';
if (marker.model) {
  line += ' If the session model differs from the hint, suggest running /model ' + marker.model + '.';
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: eventName,
    additionalContext: line
  }
}));
process.exit(0);
