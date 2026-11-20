/** Shared drag-to-resize behaviour used by every panel in the UI. */
export interface ResizeSession {
  startX: number;
  startY: number;
}

export interface ResizerOptions {
  axis: 'x' | 'y';
  onResize: (event: MouseEvent, session: ResizeSession) => void;
  onStart?: () => void;
  onEnd?: () => void;
  cursor?: string;
}

/** Mocks and embedded hosts may not expose document.body.style. */
function bodyStyle(): CSSStyleDeclaration | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.body?.style;
}

export function bindResizer(handle: HTMLElement, options: ResizerOptions): () => void {
  handle.classList?.add('wf-resizer', options.axis === 'x' ? 'wf-resizer--vertical' : 'wf-resizer--horizontal');

  let active = false;
  let startX = 0;
  let startY = 0;
  const style = bodyStyle();
  const previousCursor = style?.cursor;
  const previousSelect = style?.userSelect;

  const onMove = (event: MouseEvent): void => {
    if (!active) return;
    options.onResize(event, { startX, startY });
  };

  const onUp = (): void => {
    if (!active) return;
    active = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (style) {
      style.cursor = previousCursor ?? '';
      style.userSelect = previousSelect ?? '';
    }
    handle.classList?.remove('wf-resizer--active');
    options.onEnd?.();
  };

  const onDown = (event: MouseEvent): void => {
    event.preventDefault();
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    options.onStart?.();
    handle.classList?.add('wf-resizer--active');
    if (style) {
      style.cursor = options.cursor ?? (options.axis === 'y' ? 'row-resize' : 'col-resize');
      style.userSelect = 'none';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  handle.addEventListener('mousedown', onDown);
  return () => {
    onUp();
    handle.removeEventListener('mousedown', onDown);
  };
}
