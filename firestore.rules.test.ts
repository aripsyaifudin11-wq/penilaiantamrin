import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');

test('firestore.rules begins with global default-deny catch-all', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test('firestore.rules enforces verified email and bootstrapped admin check', () => {
  assert.match(rulesContent, /request\.auth != null && request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /request\.auth\.token\.email == 'aripsyaifudin11@gmail\.com'/);
});

test('firestore.rules isolates PII and security hashes strictly to admins', () => {
  assert.match(rulesContent, /match \/ustaz_private\/\{ustazId\} \{\s*allow get: if isValidId\(ustazId\) && isAdmin\(\);/);
  assert.match(rulesContent, /match \/admin_security\/\{docId\} \{\s*allow get, list: if isAdmin\(\);/);
});

test('firestore.rules prevents audit log tampering (update/delete denied)', () => {
  assert.match(rulesContent, /match \/grade_audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);
});

test('firestore.rules enforces terminal state locking and numeric bounds on grades', () => {
  assert.match(rulesContent, /existing\(\)\.status != 'terkunci'/);
  assert.match(rulesContent, /data\.score >= 0 && data\.score <= 100/);
});
