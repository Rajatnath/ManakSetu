import test from 'node:test';
import assert from 'node:assert/strict';
import { QCO_RECORDS, getQcoRecord } from '../src/data/qcoRecords.ts';

test('lookup misses resolve to null (not-found state, never inferred)', () => {
  assert.equal(getQcoRecord('IS 456:2000'), null);
  assert.equal(getQcoRecord('IS 1786:2008'), null);
  assert.equal(getQcoRecord('nope'), null);
});

test('IS 269 record carries product, authority and provenance', () => {
  const r = getQcoRecord('IS 269:2015');
  assert.ok(r);
  assert.ok(r.product.length > 0);
  assert.ok(r.qcoTitle.length > 0);
  assert.ok(r.authority.length > 0);
  assert.ok(r.sourceUrl.startsWith('https://'));
  assert.match(r.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('records never state a legal determination', () => {
  for (const [key, r] of Object.entries(QCO_RECORDS)) {
    const text = [r.qcoTitle, r.certificationScheme].filter(Boolean).join(' ').toLowerCase();
    assert.ok(!text.includes('legally'), `${key}: no legal determinations in dataset`);
  }
});
