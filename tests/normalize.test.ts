import test from 'node:test';
import assert from 'node:assert/strict';
import { splitValueUnit } from '../src/lib/requirements/normalize.ts';

test('strips a duplicated unit separated by whitespace', () => {
  assert.deepEqual(splitValueUnit('25 MPa', 'MPa'), { value: '25', unit: 'MPa' });
  assert.deepEqual(splitValueUnit('2 storeys', 'storeys'), { value: '2', unit: 'storeys' });
  assert.deepEqual(splitValueUnit('3.3 m', 'm'), { value: '3.3', unit: 'm' });
  assert.deepEqual(splitValueUnit('20 cubic metres', 'cubic metres'), { value: '20', unit: 'cubic metres' });
});

test('strips a duplicated unit glued to a number', () => {
  assert.deepEqual(splitValueUnit('20mm', 'mm'), { value: '20', unit: 'mm' });
});

test('does not strip when the leftover is not a measurement', () => {
  // "Fe500" ends with "500" but "Fe" is not a value — preserve faithfully.
  assert.deepEqual(splitValueUnit('Fe500', '500'), { value: 'Fe500', unit: '500' });
});

test('does not strip when nothing would remain', () => {
  assert.deepEqual(splitValueUnit('MPa', 'MPa'), { value: 'MPa', unit: 'MPa' });
});

test('matching is case-insensitive and trims', () => {
  assert.deepEqual(splitValueUnit('  25 mpa  ', 'MPa'), { value: '25', unit: 'MPa' });
});

test('null/empty inputs pass through', () => {
  assert.deepEqual(splitValueUnit(null, 'MPa'), { value: '', unit: 'MPa' });
  assert.deepEqual(splitValueUnit('25', null), { value: '25', unit: null });
  assert.deepEqual(splitValueUnit('Fe500', ''), { value: 'Fe500', unit: null });
});

test('unrelated value/unit pairs are untouched', () => {
  assert.deepEqual(splitValueUnit('Ordinary Portland Cement', 'grade'), {
    value: 'Ordinary Portland Cement',
    unit: 'grade',
  });
});
