import type { Ctx } from '@milkdown/ctx';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { Plugin } from '@milkdown/prose/state';
import { InputRule } from '@milkdown/prose/inputrules';
import {
  $inputRule,
  $nodeSchema,
  $prose,
  $remark,
} from '@milkdown/kit/utils';
import { visit } from 'unist-util-visit';

import {
  parseWikilink,
  splitWikilinkText,
  wikilinkNavigationTarget,
  type MdastLikeNode,
} from './wikilinkParsing';

export {
  parseWikilink,
  splitWikilinkText,
  wikilinkNavigationTarget,
  WIKILINK_GLOBAL,
  WIKILINK_SOURCE,
  type MdastLikeNode,
  type WikilinkRef,
} from './wikilinkParsing';

type MdastNode = MdastLikeNode;

/**
 * Remark plugin that:
 *  - at attach time registers a stringify handler emitting raw `[[...]]`
 *    syntax unescaped (remark would otherwise escape it as `\[\[...]]`);
 *  - at transform time splits `[[...]]` inside text nodes into `wikilink`
 *    mdast nodes so the custom ProseMirror node can render them.
 */
function remarkWikilink(): (this: unknown) => (tree: MdastNode) => void {
  return function (this: unknown): (tree: MdastNode) => void {
    const processor = this as {
      data?: () => Record<string, unknown>;
    };
    const data = processor.data?.() ?? {};
    const existing = Array.isArray(data.toMarkdownExtensions)
      ? (data.toMarkdownExtensions as Array<Record<string, unknown>>)
      : [];
    data.toMarkdownExtensions = [
      ...existing,
      {
        handlers: {
          wikilink(node: MdastNode) {
            return node.value ?? '';
          },
        },
      },
    ];

    return (tree: MdastNode): void => {
      visit(tree as never, 'text', (node: never, index: number | undefined, parent: never) => {
        if (index === undefined || !parent) return;
        const textNode = node as MdastNode;
        const parentNode = parent as MdastNode;
        const value = textNode.value ?? '';
        if (!value.includes('[[')) return;
        const children = splitWikilinkText(value);
        if (children.length <= 1 && children[0]?.type === 'text') return;
        parentNode.children?.splice(index, 1, ...children);
        return index + children.length;
      });
    };
  };
}

export const wikilinkRemark = $remark('wikiforgeRemarkWikilink', () => remarkWikilink());

/**
 * Inline atom node kept in sync with the remark AST.
 * `toDOM` renders a normal span so ProseMirror can handle clicks; the raw
 * syntax lives in `data-value` and is serialized back by the stringify handler.
 */
export const wikilinkSchema = $nodeSchema('wikilink', () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  parseDOM: [
    {
      tag: 'span[data-type="wikilink"]',
      getAttrs: (dom: HTMLElement) => ({
        value: dom.getAttribute('data-value') ?? '',
      }),
    },
  ],
  toDOM: (node: { attrs: Record<string, unknown> }) => {
    const value = String(node.attrs.value ?? '');
    const ref = parseWikilink(value);
    return [
      'span',
      {
        'data-type': 'wikilink',
        'data-value': value,
        'data-wikilink': ref.target,
        class: 'wikilink',
        title: value,
      },
      ref.label || value,
    ];
  },
  parseMarkdown: {
    match: node => node.type === 'wikilink',
    runner: (state, node, type) => {
      state.addNode(type, { value: (node.value as string | undefined) ?? '' });
    },
  },
  toMarkdown: {
    match: node => node.type.name === 'wikilink',
    runner: (state, node) => {
      state.addNode('wikilink', undefined, String(node.attrs.value ?? ''));
    },
  },
}));

/** Typing `[[target]]` converts the text into a wikilink atom. */
export const wikilinkInputRule = $inputRule(
  (ctx: Ctx) =>
    new InputRule(
      /\[\[([^\]]+)\]\]$/,
      (state, match, start, end) => {
        const raw = match[0];
        if (!raw) return null;
        const node = wikilinkSchema.type(ctx).create({ value: raw });
        return state.tr.replaceWith(start, end, node);
      }
    )
);

/** Dispatch a bubbling event so the adapter can open the linked note. */
export const wikilinkClickPlugin = $prose(
  () =>
    new Plugin({
      props: {
        handleClick: (_view, _pos, event) => {
          const element = event.target as HTMLElement | null;
          const anchor = element?.closest?.('span[data-type="wikilink"]');
          const raw = anchor?.getAttribute('data-value');
          if (!raw) return false;
          anchor?.dispatchEvent(
            new CustomEvent('wikiforge:wikilink', {
              bubbles: true,
              detail: { target: wikilinkNavigationTarget(raw) },
            })
          );
          return true;
        },
      },
    })
);

/** Plugins to register on the Crepe editor before `create()`. */
export const wikilinkPlugins: MilkdownPlugin[] = [
  ...(wikilinkRemark as unknown as MilkdownPlugin[]),
  ...(wikilinkSchema as unknown as MilkdownPlugin[]),
  wikilinkInputRule,
  wikilinkClickPlugin,
];
