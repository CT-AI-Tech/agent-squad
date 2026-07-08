// session-marker - shared helpers for reading the .agent-squad/session.yml
// marker and the .ai-dlc.yml hook mode config. Dependency-free by design:
// hooks may run in environments where npm install has not happened, so the
// simple YAML shapes involved are hand-parsed.
'use strict';

const fs = require('fs');
const path = require('path');

// Read hooks.<key> from .ai-dlc.yml (or AI_DLC_CONFIG override).
// Returns 'enabled' | 'warn' | 'disabled'; defaults to 'enabled'.
function readHookMode(key, cwd) {
  const base = cwd || process.cwd();
  const candidates = [
    path.resolve(base, '.ai-dlc.yml'),
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

// Read .agent-squad/session.yml. Returns an object with at least
// { skills, write_lanes, read_lanes } (arrays) plus any scalar fields found
// (role, persona, issue, model, construct_version), or null when absent.
function readSessionMarker(cwd) {
  const base = cwd || process.cwd();
  const p = path.resolve(base, '.agent-squad', 'session.yml');
  if (!fs.existsSync(p)) return null;
  try {
    const text = fs.readFileSync(p, 'utf8');
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
        } else {
          listKey = null;
          listIndent = -1;
        }
      }
      const scalarM = line.match(/^(\w+)\s*:\s*(.*)$/);
      if (scalarM) {
        const k = scalarM[1];
        const v = scalarM[2].trim();
        if (v === '') {
          if (['write_lanes', 'read_lanes', 'skills'].includes(k)) {
            listKey = k;
            listIndent = (line.match(/^(\s*)/)[1] || '').length;
          }
        } else {
          const unquoted = v.replace(/^["']|["']$/g, '');
          if (unquoted === 'null' || unquoted === '~') continue;
          out[k] = unquoted;
        }
      }
    }
    return out;
  } catch { return null; }
}

module.exports = { readHookMode, readSessionMarker };
