import test from 'node:test';
import assert from 'node:assert/strict';
import { isPageScanned, usableChars, SCANNED_CHAR_THRESHOLD } from '../src/lib/ocr/pdfText.ts';

test('threshold constant is a sane small-page cutoff', () => {
  assert.ok(SCANNED_CHAR_THRESHOLD > 0 && SCANNED_CHAR_THRESHOLD <= 200);
});

test('blank and near-blank pages count as scanned', () => {
  assert.equal(isPageScanned(''), true);
  assert.equal(isPageScanned('   \n\t  '), true);
  assert.equal(isPageScanned('Page 1'), true); // running head alone is not usable text
});

test('real tender text counts as native', () => {
  assert.equal(
    isPageScanned('TENDER FOR CONSTRUCTION OF DOUBLE-STOREY PRIMARY SCHOOL BLOCK Tender No: EDU/2026/042'),
    false
  );
});

test('usableChars ignores whitespace', () => {
  assert.equal(usableChars('a b\nc'), 3);
});
