import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARDS_METADATA, getStandardMetadata } from '../src/data/standardsMetadata.ts';

const FORBIDDEN_CURRENCY = ['legally current', 'guaranteed', 'mandatory', 'compliant', 'legally applicable'];

test('unknown standards resolve to null (unavailable state)', () => {
  assert.equal(getStandardMetadata('IS 9999:2099'), null);
  assert.equal(getStandardMetadata('IS 1786:2008'), null); // not yet verified — must stay unavailable
  assert.equal(getStandardMetadata('  IS 269:2015  ')?.standardNumber, 'IS 269:2015');
});

test('every record carries https provenance and a valid verification date', () => {
  for (const [key, m] of Object.entries(STANDARDS_METADATA)) {
    assert.equal(m.standardNumber, key);
    assert.ok(m.title.length > 0, `${key}: title`);
    assert.ok(m.sourceUrl.startsWith('https://'), `${key}: sourceUrl must be https`);
    assert.ok(m.sourceType.length > 0, `${key}: sourceType`);
    assert.match(m.lastVerifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${key}: lastVerifiedAt`);
    assert.ok(!Number.isNaN(Date.parse(m.lastVerifiedAt)), `${key}: lastVerifiedAt parses`);
  }
});

test('no record claims legal currency', () => {
  for (const [key, m] of Object.entries(STANDARDS_METADATA)) {
    const text = [m.status, m.revision, m.amendmentNote].filter(Boolean).join(' ').toLowerCase();
    for (const phrase of FORBIDDEN_CURRENCY) {
      assert.ok(!text.includes(phrase), `${key}: forbidden claim "${phrase}"`);
    }
  }
});

test('amendment counts are non-negative when present', () => {
  for (const [key, m] of Object.entries(STANDARDS_METADATA)) {
    if (m.amendmentCount !== null) assert.ok(m.amendmentCount >= 0, key);
  }
});
