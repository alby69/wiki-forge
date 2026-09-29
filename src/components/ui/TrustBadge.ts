import { WikiNote } from '../../core/types/wiki';
import { escapeHtml } from '../../core/utils/html';

export type TrustTier = 'human-reviewed' | 'machine-confirmed' | 'unverified';

export function computeNoteTrustTier(note: Partial<WikiNote>): TrustTier {
  if (note.trustTier) {
    return note.trustTier;
  }
  const verified = note.verified || (note.frontmatter?.verified as string[] | undefined) || [];
  if (Array.isArray(verified) && verified.length > 0) {
    return 'human-reviewed';
  }
  const status = note.status || (note.frontmatter?.status as string | undefined);
  if (status === 'stable') {
    return 'machine-confirmed';
  }
  return 'unverified';
}

export function isNoteStale(note: Partial<WikiNote>): boolean {
  const staleAfter = note.staleAfter || (note.frontmatter?.stale_after as string | undefined);
  if (!staleAfter) return false;
  const today = new Date().toISOString().slice(0, 10);
  return staleAfter < today;
}

export function renderTrustBadgeHTML(note: Partial<WikiNote>): string {
  const tier = computeNoteTrustTier(note);
  const stale = isNoteStale(note);

  let tierBadge = '';
  if (tier === 'human-reviewed') {
    tierBadge = `<span class="trust-badge badge-human" style="background: #22543d; color: #9ae6b4; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;" title="Human-Reviewed (Verified by human contributor)">🟢 Human-Reviewed</span>`;
  } else if (tier === 'machine-confirmed') {
    tierBadge = `<span class="trust-badge badge-machine" style="background: #2a4365; color: #90cdf4; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;" title="Machine-Confirmed (Verified by automated check or compilation)">🟡 Machine-Confirmed</span>`;
  } else {
    tierBadge = `<span class="trust-badge badge-unverified" style="background: #334155; color: #cbd5e0; padding: 2px 6px; border-radius: 4px; font-size: 11px;" title="Unverified draft">⚪ Unverified</span>`;
  }

  const staleBadge = stale
    ? `<span class="stale-badge" style="background: #742a2a; color: #feb2b2; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;" title="Stale Note (Requires review)">⏰ Stale</span>`
    : '';

  return `<div class="okf-trust-badges" style="display: inline-flex; gap: 4px; align-items: center;">${tierBadge}${staleBadge}</div>`;
}

export function renderTrustTierDot(note: Partial<WikiNote>): string {
  const tier = computeNoteTrustTier(note);
  const stale = isNoteStale(note);

  let symbol = '⚪';
  let title = 'Unverified';
  if (tier === 'human-reviewed') {
    symbol = '🟢';
    title = 'Human-Reviewed';
  } else if (tier === 'machine-confirmed') {
    symbol = '🟡';
    title = 'Machine-Confirmed';
  }

  const staleSymbol = stale ? `<span title="Stale Note" style="font-size: 10px;">⏰</span>` : '';

  return `<span class="trust-tier-dot" title="${escapeHtml(title)}" style="font-size: 10px; margin-left: auto;">${symbol}${staleSymbol}</span>`;
}
