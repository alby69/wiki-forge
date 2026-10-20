import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeNoteTrustTier, isNoteStale, renderTrustBadgeHTML, renderTrustTierDot } from '@frontend/components/ui/TrustBadge';

describe('OKF Trust Badge & Lifecycle Filter Test Suite', () => {
  test('computeNoteTrustTier correctly identifies human-reviewed notes', () => {
    const note = {
      verified: ['human:alby69'],
      status: 'stable',
    };
    assert.strictEqual(computeNoteTrustTier(note), 'human-reviewed');
  });

  test('computeNoteTrustTier identifies machine-confirmed notes', () => {
    const note = {
      verified: ['process:compile'],
      status: 'draft',
    };
    assert.strictEqual(computeNoteTrustTier(note), 'machine-confirmed');
  });

  test('computeNoteTrustTier defaults to unverified', () => {
    const note = {
      verified: [],
      status: 'stable',
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
    const note = { verified: ['human:reviewer'], status: 'stable', staleAfter: '2020-01-01' };
    const html = renderTrustBadgeHTML(note);
    assert.ok(html.includes('Human-Reviewed'));
    assert.ok(html.includes('Stale'));
  });

  test('renderTrustTierDot renders dot symbols', () => {
    const humanNote = { verified: ['human:user'] };
    const machineNote = { verified: ['process:compile'] };
    const unverifiedNote = { status: 'draft' };

    assert.ok(renderTrustTierDot(humanNote).includes('🟢'));
    assert.ok(renderTrustTierDot(machineNote).includes('🟡'));
    assert.ok(renderTrustTierDot(unverifiedNote).includes('⚪'));
  });
});
