/** Geometry captured from an element's `getBoundingClientRect()`. */
export interface AuditableRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RectOverlap {
  a: string;
  b: string;
  overlapWidth: number;
  overlapHeight: number;
  area: number;
}

/**
 * Finds colliding sibling boxes. Overlaps thinner than `minOverlapPx` on either
 * axis are treated as shared borders/rounding, not real collisions.
 */
export function findSiblingOverlaps(
  rects: AuditableRect[],
  minOverlapPx = 8
): RectOverlap[] {
  const overlaps: RectOverlap[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const first = rects[i];
      const second = rects[j];
      const overlapWidth =
        Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapHeight =
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapWidth > minOverlapPx && overlapHeight > minOverlapPx) {
        overlaps.push({
          a: first.id,
          b: second.id,
          overlapWidth,
          overlapHeight,
          area: overlapWidth * overlapHeight,
        });
      }
    }
  }
  return overlaps;
}

/** True when an element's content is wider than its own padding box. */
export function isHorizontallyOverflowing(scrollWidth: number, clientWidth: number): boolean {
  return clientWidth > 0 && scrollWidth > clientWidth + 1;
}
