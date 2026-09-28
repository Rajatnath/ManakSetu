import test from 'node:test';
import assert from 'node:assert/strict';
import { en, hi } from '../src/lib/i18n/dictionary.ts';

test('en/hi dictionaries have identical keys (toggle can never hit undefined)', () => {
  const a = Object.keys(en).sort();
  const b = Object.keys(hi).sort();
  assert.deepEqual(b, a);
});

test('no empty translations', () => {
  for (const [k, v] of Object.entries(hi)) {
    assert.ok(v.trim().length > 0, `empty hi value for ${k}`);
  }
  for (const [k, v] of Object.entries(en)) {
    assert.ok(v.trim().length > 0, `empty en value for ${k}`);
  }
});
