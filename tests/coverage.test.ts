import test from 'node:test';
import assert from 'node:assert/strict';
import { findExplicitIsReferences, normalizeIsString } from '../src/lib/coverage/explicitRefs.ts';
import { computeCoverageDiff } from '../src/lib/coverage/coverageDiff.ts';
import { en, hi } from '../src/lib/i18n/dictionary.ts';

const cand = (id: string, standard_number: string) => ({
  id, standard_number, title: '', score: 0.7, relevance: 'Low', review_status: 'pending', reasons: [],
});

// 1. Tender with explicit IS references
test('detects plain, editioned, part and IS/ISO references with pages', () => {
  const refs = findExplicitIsReferences([
    { page: 2, text: 'Concrete shall conform to IS 456 and steel to IS 1786:2008.' },
    { page: 5, text: 'Loads per IS 875 (Part 2):1987. Also IS/ISO 9001:2015 applies.' },
  ]);
  const raws = refs.map(r => r.raw);
  assert.ok(raws.some(r => r === 'IS 456'));
  assert.ok(raws.some(r => r === 'IS 1786:2008'));
  assert.ok(raws.some(r => r.includes('Part 2')));
  assert.ok(raws.some(r => r.includes('9001')));
  assert.equal(refs.find(r => r.raw === 'IS 456')?.page, 2);
  assert.ok(refs.every(r => r.context.length > r.raw.length));
});

// 2. Tender with no explicit IS references
test('returns empty for prose without IS references', () => {
  assert.deepEqual(findExplicitIsReferences([{ page: 1, text: 'Supply 5000 litres of water in good condition.' }]), []);
  assert.deepEqual(findExplicitIsReferences([]), []);
});

// normalization: edition-insensitive core keys
test('normalizes variants to comparable cores', () => {
  assert.equal(normalizeIsString('IS 456'), 'IS456');
  assert.equal(normalizeIsString('IS456:2000'), 'IS456');
  assert.equal(normalizeIsString('is 875 (Part 2):1987'), 'IS875-P2');
  assert.equal(normalizeIsString('IS/ISO 9001:2015'), 'IS9001');
  assert.equal(normalizeIsString('plain text'), null);
});

// 3 + 4. cited vs uncited candidates
test('distinguishes cited from ManakSetu-only candidates', () => {
  const diff = computeCoverageDiff(['IS456', 'IS269'], [
    cand('a', 'IS 456:2000'),
    cand('b', 'IS 269:2015'),
    cand('c', 'IS 516:1959'),
  ]);
  assert.equal(diff.citedCount, 2);
  assert.equal(diff.identifiedCount, 3);
  assert.deepEqual(diff.citedCandidateIds.sort(), ['a', 'b']);
  assert.deepEqual(diff.uncitedCandidateIds, ['c']);
  assert.equal(diff.overlapCount, 2);
  assert.equal(diff.uncitedCount, 1);
});

// 9. Empty candidate list
test('empty candidates yield zero counts without errors', () => {
  const diff = computeCoverageDiff(['IS456'], []);
  assert.deepEqual(diff, {
    citedCount: 1, identifiedCount: 0, overlapCount: 0, uncitedCount: 0,
    citedCandidateIds: [], uncitedCandidateIds: [],
  });
});

// 11 + 12. zero explicit refs => every candidate is discovery (never a violation)
test('zero explicit references makes all candidates uncited discovery', () => {
  const diff = computeCoverageDiff([], [cand('a', 'IS 456:2000'), cand('b', 'IS 269:2015')]);
  assert.equal(diff.citedCount, 0);
  assert.equal(diff.uncitedCount, 2);
});

// duplicates across pages collapse to one reference
test('dedupes repeated references across pages', () => {
  const refs = findExplicitIsReferences([
    { page: 1, text: 'Use IS 456 for concrete.' },
    { page: 3, text: 'Again IS 456:2000 applies.' },
  ]);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].core, 'IS456');
});

// 10. Hindi labels for the new coverage UI exist and are non-empty
test('coverage UI labels translated', () => {
  for (const k of ['coverageTitle', 'explicitCited', 'identifiedByManaksetu', 'noExplicitRefs', 'uncitedNote', 'relatedTest', 'whyMattersBody', 'inspectBtn', 'allCited'] as const) {
    assert.ok(en[k].trim().length > 0, `en.${k}`);
    assert.ok(hi[k].trim().length > 0, `hi.${k}`);
  }
});
