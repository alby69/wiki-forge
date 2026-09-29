import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeNoteTrustTier, isNoteStale, renderTrustBadgeHTML, renderTrustTierDot } from '../src/components/ui/TrustBadge';

describe('OKF Trust Badge & Lifecycle Filter Test Suite', () => {
  test('computeNoteTrustTier correctly identifies human-reviewed notes', () => {
    const note = {
      verified: ['alby69'],
      status: 'stable',
    };
    assert.strictEqual(computeNoteTrustTier(note), 'human-reviewed');
  });

  test('computeNoteTrustTier identifies machine-confirmed notes', () => {
    const note = {
      verified: [],
      status: 'stable',
    };
    assert.strictEqual(computeNoteTrustTier(note), 'machine-confirmed');
  });

  test('computeNoteTrustTier defaults to unverified', () => {
    const note = {
      verified: [],
      status: 'draft',
    };
    assert.strictEqual(computeNoteTrustTier(note), 'unverified');
  });

  test('isNoteStale detects expired notes', () => {
    const staleNote = { staleAfter: '2020-01-01' };
    const freshNote = { staleAfter: '2099-12-31' };
    assert.strictEqual(isNoteStale(staleNote), true);
    assert.strictEqual(isNoteStale(freshNote), false);
  });

  test('renderTrustBadgeHTML generates valid HTML strings', () => {
    const note = { verified: ['reviewer'], status: 'stable', staleAfter: '2020-01-01' };
    const html = renderTrustBadgeHTML(note);
    assert.ok(html.includes('Human-Reviewed'));
    assert.ok(html.includes('Stale'));
  });

  test('renderTrustTierDot renders dot symbols', () => {
    const humanNote = { verified: ['user'] };
    const machineNote = { status: 'stable' };
    const unverifiedNote = { status: 'draft' };

    assert.ok(renderTrustTierDot(humanNote).includes('🟢'));
    assert.ok(renderTrustTierDot(machineNote).includes('🟡'));
    assert.ok(renderTrustTierDot(unverifiedNote).includes('⚪'));
  });
});
