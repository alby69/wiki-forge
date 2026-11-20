/**
 * Pure helpers for Wiki-Forge wikilink syntax. Kept free of Milkdown imports so
 * they can be unit-tested in Node and reused by other editors.
 *
 * Supported forms (all round-trip byte-for-byte through Milkdown):
 *   [[target]]
 *   [[target|label]]
 *   [[folder/target#heading|label]]
 *   [[predicate::target|label]]
 */
export const WIKILINK_SOURCE = '(\\[\\[[^\\]]+\\]\\])';
export const WIKILINK_GLOBAL = new RegExp(WIKILINK_SOURCE, 'g');

export interface WikilinkRef {
  raw: string;
  target: string;
  label: string;
  anchor: string;
  predicate: string;
}

export interface MdastLikeNode {
  type: string;
  value?: string;
  children?: MdastLikeNode[];
}

export function parseWikilink(raw: string): WikilinkRef {
  const trimmed = raw.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  const [left, ...labelParts] = trimmed.split('|');
  const label = labelParts.join('|').trim();
  const [targetPart, ...anchorParts] = left.split('#');
  const anchor = anchorParts.join('#').trim();
  let target = targetPart.trim();
  let predicate = '';

  const separator = target.lastIndexOf('::');
  if (separator >= 0) {
    predicate = target.slice(0, separator).trim();
    target = target.slice(separator + 2).trim();
  }

  return {
    raw,
    target: target || (predicate ? `${predicate}::` : ''),
    label: label || target,
    anchor,
    predicate,
  };
}

/** Target used by the router when a wikilink is clicked. */
export function wikilinkNavigationTarget(raw: string): string {
  const { target, anchor } = parseWikilink(raw);
  return anchor ? `${target}#${anchor}` : target;
}

/** Split a Markdown text node into plain text and `wikilink` mdast nodes. */
export function splitWikilinkText(value: string): MdastLikeNode[] {
  const nodes: MdastLikeNode[] = [];
  const regex = new RegExp(WIKILINK_GLOBAL.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > last) {
      nodes.push({ type: 'text', value: value.slice(last, match.index) });
    }
    nodes.push({ type: 'wikilink', value: match[0] });
    last = match.index + match[0].length;
  }

  if (last < value.length) {
    nodes.push({ type: 'text', value: value.slice(last) });
  }
  return nodes;
}
