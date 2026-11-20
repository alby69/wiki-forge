import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { undoDepth, redoDepth } from '@milkdown/kit/prose/history';
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
} from '@milkdown/kit/preset/commonmark';
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { replaceAll } from '@milkdown/kit/utils';

import type {
  BlockFormat,
  InlineFormat,
  NoteEditorAdapter,
} from '../EditorAdapter';
import { wikilinkPlugins } from './wikilink';

export interface MilkdownAdapterOptions {
  /** Storage used for image uploads. When omitted, local blob URLs are used. */
  uploadFile?: (folder: string, name: string, data: ArrayBuffer) => Promise<boolean>;
}

const inlineCommands: Record<InlineFormat, unknown> = {
  strong: toggleStrongCommand,
  emphasis: toggleEmphasisCommand,
  strike: toggleStrikethroughCommand,
  code: toggleInlineCodeCommand,
};

const blockCommands: Partial<Record<BlockFormat, unknown>> = {
  'bullet-list': wrapInBulletListCommand,
  'ordered-list': wrapInOrderedListCommand,
  quote: wrapInBlockquoteCommand,
};

/**
 * WYSIWYG engine based on Milkdown/Crepe.
 *
 * Crepe supplies the toolbar, tables, KaTeX, slash commands and CodeMirror
 * code blocks. Wiki-Forge-specific features (AI, Review/Research/Studio) stay
 * in the shell; the AI feature is deliberately disabled.
 */
export class MilkdownAdapter implements NoteEditorAdapter {
  readonly engine = 'milkdown' as const;

  private crepe: Crepe | null = null;
  private root: HTMLElement | null = null;
  private changeCb: (body: string) => void = () => {};
  private wikilinkCb: (target: string) => void = () => {};
  private onClick: (event: Event) => void;

  constructor(private readonly options: MilkdownAdapterOptions = {}) {
    this.onClick = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target) this.wikilinkCb(detail.target);
    };
  }

  async mount(root: HTMLElement, markdown: string): Promise<void> {
    const features: Partial<Record<CrepeFeature, boolean>> = {
      [CrepeFeature.AI]: false,
      [CrepeFeature.CodeMirror]: true,
      [CrepeFeature.ListItem]: true,
      [CrepeFeature.LinkTooltip]: true,
      [CrepeFeature.Cursor]: true,
      [CrepeFeature.ImageBlock]: true,
      [CrepeFeature.BlockEdit]: true,
      [CrepeFeature.Toolbar]: true,
      [CrepeFeature.Placeholder]: true,
      [CrepeFeature.Table]: true,
      [CrepeFeature.Latex]: true,
      [CrepeFeature.TopBar]: false,
    };

    const crepe = new Crepe({
      root,
      defaultValue: markdown,
      features,
      featureConfigs: {
        [CrepeFeature.ImageBlock]: {
          onUpload: async (file: File) => this.upload(file),
          proxyDomURL: url => url,
        },
      },
    });

    wikilinkPlugins.forEach(plugin => crepe.editor.use(plugin));

    await crepe.create();

    this.crepe = crepe;
    this.root = root;
    root.addEventListener('wikiforge:wikilink', this.onClick);

    crepe.on(listener => {
      listener.markdownUpdated((_ctx, markdownText) => {
        this.changeCb(markdownText);
      });
    });
  }

  getMarkdown(): string {
    return this.crepe ? this.crepe.getMarkdown() : '';
  }

  replace(markdown: string): void {
    if (!this.crepe) return;
    this.crepe.editor.action(replaceAll(markdown, true));
  }

  setReadonly(value: boolean): void {
    this.crepe?.setReadonly(value);
  }

  onChange(cb: (body: string) => void): void {
    this.changeCb = cb;
  }

  onWikilinkClick(cb: (target: string) => void): void {
    this.wikilinkCb = cb;
  }

  toggleInline(format: InlineFormat): void {
    this.callCommand(inlineCommands[format]);
  }

  applyBlock(format: BlockFormat): void {
    if (format === 'heading1' || format === 'heading2' || format === 'heading3') {
      const level = Number(format.slice(-1));
      this.callCommand(wrapInHeadingCommand, level);
      return;
    }
    const command = blockCommands[format];
    if (command) this.callCommand(command);
  }

  insertColor(color: string): void {
    if (color) this.insertHtml(`<span style="color: ${color};">`, '</span>', 'testo colorato');
  }

  insertAlignment(align: string): void {
    if (align) this.insertHtml(`<div align="${align}">\n`, '\n</div>', 'testo allineato');
  }

  undo(): void {
    this.callCommand(undoCommand);
  }

  redo(): void {
    this.callCommand(redoCommand);
  }

  canUndo(): boolean {
    return this.historyDepth(true);
  }

  canRedo(): boolean {
    return this.historyDepth(false);
  }

  focus(): void {
    if (!this.crepe) return;
    this.crepe.editor.action(ctx => {
      ctx.get(editorViewCtx).focus();
    });
  }

  async destroy(): Promise<void> {
    const crepe = this.crepe;
    this.crepe = null;
    if (!crepe) return;
    this.root?.removeEventListener('wikiforge:wikilink', this.onClick);
    this.root = null;
    await crepe.destroy();
  }

  private callCommand(key: unknown, payload?: unknown): void {
    if (!this.crepe) return;
    this.crepe.editor.action(ctx => {
      ctx.get(commandsCtx).call(key as never, payload as never);
    });
  }

  private historyDepth(undo: boolean): boolean {
    if (!this.crepe) return false;
    let depth = 0;
    this.crepe.editor.action(ctx => {
      const state = ctx.get(editorViewCtx).state;
      depth = undo ? undoDepth(state) : redoDepth(state);
    });
    return depth > 0;
  }

  /**
   * Insert raw HTML as Milkdown `html` nodes so remark-stringify preserves it
   * byte-for-byte instead of escaping `<` and `>`.
   */
  private insertHtml(before: string, after: string, placeholder: string): void {
    if (!this.crepe) return;
    this.crepe.editor.action(ctx => {
      const view = ctx.get(editorViewCtx);
      const { schema } = view.state;
      const htmlType = (schema.nodes as Record<string, unknown>)['html'] as {
        create: (attrs: Record<string, unknown>) => never;
      } | undefined;
      if (!htmlType) return;

      const { from, to } = view.state.selection;
      const selected = view.state.doc.textBetween(from, to) || placeholder;
      const nodes = [
        htmlType.create({ value: before }),
        schema.text(selected),
        htmlType.create({ value: after }),
      ];
      view.dispatch(view.state.tr.replaceWith(from, to, nodes));
    });
  }

  private async upload(file: File): Promise<string> {
    const safeName = encodeURIComponent(file.name.replace(/[^\w.\-]/g, '_'));
    if (!this.options.uploadFile) return URL.createObjectURL(file);
    const buffer = await file.arrayBuffer();
    const ok = await this.options.uploadFile('raw/assets', safeName, buffer);
    return ok ? `raw/assets/${safeName}` : URL.createObjectURL(file);
  }
}
