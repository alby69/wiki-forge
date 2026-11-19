/** Layout bounds of the resizable Console Output panel in the KE Workbench. */
export const CONSOLE_MIN_HEIGHT = 96;
export const CONSOLE_MAX_HEIGHT = 520;

/** Minimum space left to the Use Case details pane above the console. */
export const CONSOLE_RESERVED_TOP_SPACE = 180;

/**
 * Clamp a requested console height to sensible bounds.
 *
 * When the available container height is known, the console can never eat the
 * whole Workbench: at least `CONSOLE_RESERVED_TOP_SPACE` pixels stay available
 * for the Use Case steps. Invalid values fall back to the minimum so a stale
 * localStorage entry can never break the layout.
 */
export function clampConsoleHeight(
  requestedHeight: number,
  containerHeight?: number
): number {
  const viewportMax = Number.isFinite(containerHeight)
    ? Math.max(
        CONSOLE_MIN_HEIGHT,
        Math.min(
          CONSOLE_MAX_HEIGHT,
          (containerHeight as number) - CONSOLE_RESERVED_TOP_SPACE
        )
      )
    : CONSOLE_MAX_HEIGHT;

  if (!Number.isFinite(requestedHeight)) return CONSOLE_MIN_HEIGHT;
  return Math.max(CONSOLE_MIN_HEIGHT, Math.min(viewportMax, requestedHeight));
}
