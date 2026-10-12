#!/usr/bin/env node
/**
 * docs/contracts/validate.js
 * Validates JSON examples against their schemas.
 * Usage: node docs/contracts/validate.js
 * Deps:  npm install ajv ajv-formats  (run once from docs/contracts/)
 */
'use strict';

const fs   = require('fs');
const path = require('path');

let Ajv, addFormats;
try {
  Ajv        = require('ajv');
  addFormats = require('ajv-formats');
} catch {
  console.error('ERROR: dependencies missing.  Run:  npm install ajv ajv-formats');
  process.exit(2);
}

const BASE = __dirname;
const ajv  = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const PAIRS = [
  ['session_payload.schema.json', 'session_payload.example.json'],
  ['pose_config.schema.json',     'pose_config.heel_raise.example.json'],
  ['pose_config.schema.json',     'pose_config.ankle_pump.example.json'],
];

const KNOWN_ERROR_CODES = new Set([
  'too_fast', 'low_height', 'knee_valgus',
  'early_heel_lift', 'hip_hike', 'low_confidence',
]);

// Strip _comment* keys and BOM from loaded JSON
function loadJson(filePath) {
  const text = fs.readFileSync(path.join(BASE, filePath), 'utf8')
    .replace(/^\uFEFF/, ''); // strip BOM if present
  return stripComments(JSON.parse(text));
}

function stripComments(obj) {
  if (Array.isArray(obj))  return obj.map(stripComments);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !k.startsWith('_comment'))
        .map(([k, v]) => [k, stripComments(v)])
    );
  }
  return obj;
}

function validatePair(schemaFile, exampleFile) {
  const schema  = loadJson(schemaFile);
  const example = loadJson(exampleFile);
  // Reuse cached validator if schema was already compiled (same $id)
  const validate = schema.$id && ajv.getSchema(schema.$id)
    ? ajv.getSchema(schema.$id)
    : ajv.compile(schema);
  if (validate(example)) return [];
  return (validate.errors || []).map(
    e => `  ${e.instancePath || '(root)'} [${e.keyword}] ${e.message}`
  );
}

function validateErrorCodes(exampleFile) {
  const example  = loadJson(exampleFile);
  const problems = [];
  for (const ex of example.exercises || []) {
    for (const rep of ex.reps || []) {
      for (const code of rep.errors || []) {
        if (!KNOWN_ERROR_CODES.has(code)) {
          problems.push(
            `  Unknown error code '${code}' in set ${rep.set_no} rep ${rep.rep_no}`
          );
        }
      }
    }
  }
  return problems;
}

let allPassed = true;

for (const [schemaFile, exampleFile] of PAIRS) {
  console.log(`\nValidating ${exampleFile} against ${schemaFile} ...`);
  const errors = validatePair(schemaFile, exampleFile);
  if (errors.length) {
    allPassed = false;
    console.log(`  FAIL (${errors.length} error(s))`);
    errors.forEach(e => console.log(e));
  } else {
    console.log('  PASS');
  }
}

console.log('\nChecking error codes in session_payload.example.json ...');
const codeErrors = validateErrorCodes('session_payload.example.json');
if (codeErrors.length) {
  allPassed = false;
  console.log(`  FAIL (${codeErrors.length} unknown code(s))`);
  codeErrors.forEach(e => console.log(e));
} else {
  console.log('  PASS');
}

console.log();
if (allPassed) {
  console.log('All contracts valid.');
  process.exit(0);
} else {
  console.log('Validation FAILED — see errors above.');
  process.exit(1);
}