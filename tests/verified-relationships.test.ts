import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_RELATIONSHIPS } from '../src/data/verifiedRelationships.ts';

const ALLOWED_TYPES = ['normative_reference', 'test_method_reference', 'related_standard'];

test('every seeded relationship cites an https authoritative source', () => {
  assert.ok(VERIFIED_RELATIONSHIPS.length > 0, 'at least one verified relationship must exist');
  for (const r of VERIFIED_RELATIONSHIPS) {
    assert.ok(r.source && r.target && r.source !== r.target);
    assert.ok(ALLOWED_TYPES.includes(r.relationship_type), `type ${r.relationship_type}`);
    assert.ok(r.evidence.length > 20, 'evidence must explain the basis');
    assert.ok(r.source_url.startsWith('https://'), 'source_url must be https');
    assert.ok(!/heuristic|same sector/i.test(r.evidence), 'heuristics must never be seeded as verified');
  }
});
