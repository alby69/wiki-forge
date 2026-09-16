export class Skeleton {
  public static renderBox(width: string = '100%', height: string = '16px', margin: string = '4px 0'): string {
    return `<div class="skeleton-box" style="width: ${width}; height: ${height}; margin: ${margin};"></div>`;
  }

  public static renderTree(count: number = 6): string {
    let items = '';
    const widths = ['70%', '85%', '50%', '90%', '65%', '80%'];
    for (let i = 0; i < count; i++) {
      const w = widths[i % widths.length];
      const indent = (i % 3) * 12;
      items += `
        <div style="padding: 6px 8px 6px ${8 + indent}px; display: flex; align-items: center; gap: 8px;">
          <div class="skeleton-box" style="width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;"></div>
          <div class="skeleton-box" style="width: ${w}; height: 13px; border-radius: 3px;"></div>
        </div>
      `;
    }
    return `<div class="skeleton-tree-loader" role="status" aria-label="Loading vault tree">${items}</div>`;
  }

  public static renderChatMessage(): string {
    return `
      <div class="skeleton-chat-message" role="status" aria-label="Waiting for assistant response" style="align-self: flex-start; max-width: 85%; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #1e2330; border-radius: 8px; width: 80%;">
        <div class="skeleton-box" style="width: 40%; height: 12px; border-radius: 3px;"></div>
        <div class="skeleton-box" style="width: 90%; height: 12px; border-radius: 3px;"></div>
        <div class="skeleton-box" style="width: 70%; height: 12px; border-radius: 3px;"></div>
      </div>
    `;
  }

  public static renderGraph(): string {
    return `
      <div class="skeleton-graph-loader" role="status" aria-label="Initializing graph view" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: #18191c;">
        <div class="skeleton-box" style="width: 60px; height: 60px; border-radius: 50%;"></div>
        <div class="skeleton-box" style="width: 140px; height: 14px; border-radius: 4px;"></div>
      </div>
    `;
  }
}
