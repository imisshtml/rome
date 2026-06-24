export interface HoverPreviewAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HOVER_PREVIEW_GAP = 8;
export const HOVER_PREVIEW_MARGIN = 8;

/** Place enlarged preview beside the hovered card, clamped inside the viewport. */
export function computeAdjacentHoverPreviewPosition(
  anchor: HoverPreviewAnchor,
  previewWidth: number,
  previewHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  const margin = HOVER_PREVIEW_MARGIN;
  const gap = HOVER_PREVIEW_GAP;
  const cardCenterX = anchor.x + anchor.width / 2;
  const preferRight = cardCenterX < viewportWidth / 2;

  let left: number;
  if (preferRight) {
    left = anchor.x + anchor.width + gap;
    if (left + previewWidth > viewportWidth - margin) {
      left = anchor.x - previewWidth - gap;
    }
  } else {
    left = anchor.x - previewWidth - gap;
    if (left < margin) {
      left = anchor.x + anchor.width + gap;
    }
  }
  left = Math.max(margin, Math.min(left, viewportWidth - previewWidth - margin));

  let top = anchor.y + anchor.height / 2 - previewHeight / 2;
  top = Math.max(margin, Math.min(top, viewportHeight - previewHeight - margin));

  return { left, top };
}
