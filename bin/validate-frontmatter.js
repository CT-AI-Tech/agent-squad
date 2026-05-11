#!/usr/bin/env node
// validate-frontmatter — validate persona and skill frontmatter
// ----------------------------------------------------------------------------
// Usage:
//   node bin/validate-frontmatter.js <path>... [--kind persona|skill]
//
// If --kind is omitted, the kind is inferred from path:
//   personas/*.md       -> persona
//   skills/**/SKILL.md  -> skill
//
// Exit codes:
//   0 — all files valid
//   1 — at least one file invalid (errors printed to stderr)
//   2 — invocation error (bad args, missing files, etc.)
// ----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('validate-frontmatter: js-yaml is required. Run `npm install`.');
  process.exit(2);
}

const VALID_PERSONA_NAMES = ['lead', 'architect', 'implementer'];
const VALID_AFFINITY = ['implementer', 'architect', 'lead', 'both'];
const VALID_MODES = ['plan', 'execute'];

const REQUIRED_PERSONA_FIELDS = [
  'name',
  'version',
  'construct_version',
  'description',
  'owner',
  'behavior',
  'default_mode',
  'plan_mode_triggers',
  'self_review_format',
];

const REQUIRED_PERSONA_BEHAVIOR = ['invoked_when', 'outputs', 'prohibited'];

const REQUIRED_SKILL_FIELDS = [
  'name',
  'version',
  'construct_version',
  'description',
  'persona_affinity',
  'domain',
  'owner',
];

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  try {
    return yaml.load(m[1]);
  } catch (e) {
    return { __parse_error: e.message };
  }
}

function inferKind(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (/(?:^|\/)personas\/[^/]+\.md$/.test(norm)) return 'persona';
  if (/(?:^|\/)skills\/[^/]+(?:\/[^/]+)*\/SKILL\.md$/.test(norm)) return 'skill';
  return null;
}

function validateSemver(s) {
  // Accept full semver and semver ranges with leading >=, ^, ~, or bare exact.
  return /^(?:[>^~]=?|>=)?\s*\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(String(s).trim());
}

function validatePersona(fm, filePath) {
  const errors = [];
  if (fm.__parse_error) {
    return [`frontmatter does not parse: ${fm.__parse_error}`];
  }
  const expectedName = path.basename(filePath, '.md');
  if (fm.name !== expectedName) {
    errors.push(`name "${fm.name}" must match filename "${expectedName}"`);
  }
  if (!VALID_PERSONA_NAMES.includes(fm.name)) {
    errors.push(
      `name "${fm.name}" is not in the v0.x persona set: ${VALID_PERSONA_NAMES.join(', ')}`
    );
  }
  for (const f of REQUIRED_PERSONA_FIELDS) {
    if (!(f in fm)) errors.push(`missing required field: ${f}`);
  }
  if (fm.version && !validateSemver(fm.version)) {
    errors.push(`version "${fm.version}" is not a valid semver`);
  }
  if (fm.construct_version && !validateSemver(fm.construct_version)) {
    errors.push(`construct_version "${fm.construct_version}" is not a valid semver`);
  }
  if (fm.default_mode && !VALID_MODES.includes(fm.default_mode)) {
    errors.push(`default_mode "${fm.default_mode}" must be one of: ${VALID_MODES.join(', ')}`);
  }
  if (fm.plan_mode_triggers !== undefined && !Array.isArray(fm.plan_mode_triggers)) {
    errors.push('plan_mode_triggers must be a list (may be empty)');
  }
  if (fm.behavior && typeof fm.behavior === 'object') {
    for (const f of REQUIRED_PERSONA_BEHAVIOR) {
      if (!(f in fm.behavior)) {
        errors.push(`behavior.${f} is required`);
      } else if (!Array.isArray(fm.behavior[f])) {
        errors.push(`behavior.${f} must be a list`);
      }
    }
  }
  return errors;
}

function validateSkill(fm, filePath) {
  const errors = [];
  if (fm.__parse_error) {
    return [`frontmatter does not parse: ${fm.__parse_error}`];
  }
  const parentDir = path.basename(path.dirname(filePath));
  if (fm.name !== parentDir) {
    errors.push(`name "${fm.name}" must match parent directory "${parentDir}"`);
  }
  for (const f of REQUIRED_SKILL_FIELDS) {
    if (!(f in fm)) errors.push(`missing required field: ${f}`);
  }
  if (fm.version && !validateSemver(fm.version)) {
    errors.push(`version "${fm.version}" is not a valid semver`);
  }
  if (fm.construct_version && !validateSemver(fm.construct_version)) {
    errors.push(
      `construct_version "${fm.construct_version}" is not a valid semver range`
    );
  }
  if (fm.persona_affinity !== undefined) {
    if (!Array.isArray(fm.persona_affinity)) {
      errors.push('persona_affinity must be a list');
    } else {
      for (const v of fm.persona_affinity) {
        if (!VALID_AFFINITY.includes(v)) {
          errors.push(
            `persona_affinity value "${v}" must be one of: ${VALID_AFFINITY.join(', ')}`
          );
        }
      }
    }
  }
  if (fm.hooks && typeof fm.hooks !== 'object') {
    errors.push('hooks must be an object when present');
  }
  return errors;
}

function validateFile(filePath, kindOverride) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, errors: [`file does not exist: ${filePath}`] };
  }
  const kind = kindOverride || inferKind(filePath);
  if (!kind) {
    return {
      ok: false,
      errors: [`cannot infer kind for ${filePath}; pass --kind persona|skill`],
    };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm) {
    return { ok: false, errors: ['no YAML frontmatter found (file must start with ---)'] };
  }
  const errors = kind === 'persona' ? validatePersona(fm, filePath) : validateSkill(fm, filePath);
  return { ok: errors.length === 0, errors, kind };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: validate-frontmatter <path>... [--kind persona|skill]');
    process.exit(2);
  }
  let kindOverride = null;
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--kind') {
      kindOverride = args[++i];
      if (!['persona', 'skill'].includes(kindOverride)) {
        console.error(`--kind must be "persona" or "skill" (got "${kindOverride}")`);
        process.exit(2);
      }
    } else {
      paths.push(args[i]);
    }
  }

  let anyFailed = false;
  for (const p of paths) {
    const res = validateFile(p, kindOverride);
    if (res.ok) {
      console.log(`[ok] ${p} (${res.kind})`);
    } else {
      anyFailed = true;
      console.error(`[fail] ${p}`);
      for (const e of res.errors) console.error(`  - ${e}`);
    }
  }
  process.exit(anyFailed ? 1 : 0);
}

main();
