#!/usr/bin/env node
// validate-role-schema — validate the YAML role block inside a project AGENTS.md
// ----------------------------------------------------------------------------
// Usage:
//   node bin/validate-role-schema.js <path-to-AGENTS.md>
//
// Parses the first ```yaml fenced block in the file and validates it against
// the role-schema defined in contract/role-schema.md.
//
// Exit codes:
//   0 — valid
//   1 — invalid (errors printed to stderr)
//   2 — invocation error
// ----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('validate-role-schema: js-yaml is required. Run `npm install`.');
  process.exit(2);
}

const VALID_PERSONAS = ['lead', 'architect', 'implementer'];
const VALID_HOOK_MODES = ['enabled', 'warn', 'disabled'];
const VALID_MODELS = ['opus', 'sonnet', 'haiku', 'inherit'];
const RESERVED_TOP_LEVEL_KEYS = ['personas', 'policies'];

function extractYamlBlock(text) {
  // Match first ```yaml ... ``` fenced block
  const m = text.match(/```yaml\r?\n([\s\S]*?)\r?\n```/);
  if (!m) return null;
  try {
    return yaml.load(m[1]);
  } catch (e) {
    return { __parse_error: e.message };
  }
}

function validateRole(role, idx) {
  const errors = [];
  const ctx = role && role.name ? `role[${idx}] "${role.name}"` : `role[${idx}]`;

  if (!role || typeof role !== 'object') {
    return [`${ctx}: not an object`];
  }
  if (!role.name) errors.push(`${ctx}: missing required field "name"`);
  else if (!/^[a-z][a-z0-9-]*$/.test(role.name)) {
    errors.push(`${ctx}: name "${role.name}" must be kebab-case`);
  }
  if (!role.persona) errors.push(`${ctx}: missing required field "persona"`);
  else if (!VALID_PERSONAS.includes(role.persona)) {
    errors.push(
      `${ctx}: persona "${role.persona}" must be one of: ${VALID_PERSONAS.join(', ')}`
    );
  }
  if (!('skills' in role)) {
    errors.push(`${ctx}: missing required field "skills" (use empty list if none)`);
  } else if (!Array.isArray(role.skills)) {
    errors.push(`${ctx}: skills must be a list`);
  }
  if (!role.lanes || typeof role.lanes !== 'object') {
    errors.push(`${ctx}: missing required field "lanes" (object with write + optional read)`);
  } else {
    if (!('write' in role.lanes)) {
      errors.push(`${ctx}: lanes.write is required (use empty list if none)`);
    } else if (!Array.isArray(role.lanes.write)) {
      errors.push(`${ctx}: lanes.write must be a list of globs`);
    }
    if ('read' in role.lanes && !Array.isArray(role.lanes.read)) {
      errors.push(`${ctx}: lanes.read must be a list of globs when present`);
    }
  }
  if ('model' in role && !VALID_MODELS.includes(role.model)) {
    errors.push(
      `${ctx}: model "${role.model}" must be one of: ${VALID_MODELS.join(', ')}`
    );
  }
  if (role.hooks_overrides) {
    if (typeof role.hooks_overrides !== 'object') {
      errors.push(`${ctx}: hooks_overrides must be an object`);
    } else {
      for (const [k, v] of Object.entries(role.hooks_overrides)) {
        if (!VALID_HOOK_MODES.includes(v)) {
          errors.push(
            `${ctx}: hooks_overrides.${k} must be one of: ${VALID_HOOK_MODES.join(', ')}`
          );
        }
      }
    }
  }
  return errors;
}

function validateBlock(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return ['YAML block did not parse to an object'];
  }
  if (doc.__parse_error) {
    return [`YAML block parse error: ${doc.__parse_error}`];
  }
  if (!doc.construct_version) {
    errors.push('top-level "construct_version" is required');
  }
  if (!doc.roles || !Array.isArray(doc.roles) || doc.roles.length === 0) {
    errors.push('top-level "roles" is required and must be a non-empty list');
  } else {
    // Role-level
    const seenNames = new Set();
    doc.roles.forEach((r, i) => {
      validateRole(r, i).forEach((e) => errors.push(e));
      if (r && r.name) {
        if (seenNames.has(r.name)) {
          errors.push(`role name "${r.name}" appears more than once`);
        }
        seenNames.add(r.name);
      }
    });
    // At least one "lead" persona role MUST exist
    const hasLead = doc.roles.some((r) => r && r.persona === 'lead');
    if (!hasLead) {
      errors.push('at least one role with persona "lead" is required');
    }
  }
  // Reserved keys
  for (const k of RESERVED_TOP_LEVEL_KEYS) {
    if (k in doc) {
      errors.push(`top-level key "${k}" is reserved for future use and MUST NOT be present`);
    }
  }
  // contract_first (optional)
  if (doc.contract_first) {
    if (typeof doc.contract_first !== 'object') {
      errors.push('contract_first must be an object when present');
    } else if (
      doc.contract_first.required_for &&
      !Array.isArray(doc.contract_first.required_for)
    ) {
      errors.push('contract_first.required_for must be a list');
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: validate-role-schema <path-to-AGENTS.md>');
    process.exit(2);
  }
  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    console.error(`file does not exist: ${filePath}`);
    process.exit(2);
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const doc = extractYamlBlock(text);
  if (doc === null) {
    console.error(
      `[fail] ${filePath}: no \`\`\`yaml block found — the role declarations must be in a fenced YAML block`
    );
    process.exit(1);
  }
  const errors = validateBlock(doc);
  if (errors.length === 0) {
    console.log(`[ok] ${filePath}`);
    process.exit(0);
  }
  console.error(`[fail] ${filePath}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
