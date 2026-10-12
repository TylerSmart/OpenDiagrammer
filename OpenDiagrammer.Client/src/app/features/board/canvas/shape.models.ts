export type ShapeType = 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'diamond';

export interface CanvasShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  text?: string;
  zIndex: number;
  locked?: boolean;
}

export type ResizeHandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export type ActiveTool =
  'select' | 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'diamond' | 'connection';

export const SHAPE_CONSTANTS = {
  MIN_WIDTH: 30,
  MIN_HEIGHT: 30,
  DEFAULT_WIDTH: 120,
  DEFAULT_HEIGHT: 80,
  DEFAULT_FILL: 'rgba(255, 255, 255, 0.95)',
  DEFAULT_STROKE: '#333333',
  DEFAULT_STROKE_WIDTH: 2,
} as const;

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  coordinate: number;
  start: number;
  end: number;
}

export interface SnappingResult {
  snappedDeltaX: number;
  snappedDeltaY: number;
  guides: AlignmentGuide[];
}

/**
 * Computes snapping offsets and alignment guidelines when moving a bounding box relative to other shapes or a grid.
 */
export function computeShapeMovementSnapping(
  initialMovingBounds: BoundingBox,
  targetShapes: CanvasShape[],
  rawDeltaX: number,
  rawDeltaY: number,
  snapThreshold = 8,
  gridSize?: number,
): SnappingResult {
  const currentMinX = initialMovingBounds.minX + rawDeltaX;
  const currentMaxX = initialMovingBounds.maxX + rawDeltaX;
  const currentCenterX = currentMinX + initialMovingBounds.width / 2;

  const currentMinY = initialMovingBounds.minY + rawDeltaY;
  const currentMaxY = initialMovingBounds.maxY + rawDeltaY;
  const currentCenterY = currentMinY + initialMovingBounds.height / 2;

  let bestDiffX: number | null = null;
  let bestDistX = Infinity;
  let guideX: AlignmentGuide | null = null;

  let bestDiffY: number | null = null;
  let bestDistY = Infinity;
  let guideY: AlignmentGuide | null = null;

  // Moving X candidate points
  const movingXCandidates = [
    { pos: currentMinX, offset: 0 },
    { pos: currentCenterX, offset: initialMovingBounds.width / 2 },
    { pos: currentMaxX, offset: initialMovingBounds.width },
  ];

  // Moving Y candidate points
  const movingYCandidates = [
    { pos: currentMinY, offset: 0 },
    { pos: currentCenterY, offset: initialMovingBounds.height / 2 },
    { pos: currentMaxY, offset: initialMovingBounds.height },
  ];

  for (const target of targetShapes) {
    const targetXs = [target.x, target.x + target.width / 2, target.x + target.width];
    const targetYs = [target.y, target.y + target.height / 2, target.y + target.height];

    // Check X snap
    for (const mc of movingXCandidates) {
      for (const tx of targetXs) {
        const diff = tx - mc.pos;
        const dist = Math.abs(diff);
        if (dist <= snapThreshold && dist < bestDistX) {
          bestDistX = dist;
          bestDiffX = diff;
          guideX = {
            type: 'vertical',
            coordinate: tx,
            start: Math.min(currentMinY, target.y) - 15,
            end: Math.max(currentMaxY, target.y + target.height) + 15,
          };
        }
      }
    }

    // Check Y snap
    for (const mc of movingYCandidates) {
      for (const ty of targetYs) {
        const diff = ty - mc.pos;
        const dist = Math.abs(diff);
        if (dist <= snapThreshold && dist < bestDistY) {
          bestDistY = dist;
          bestDiffY = diff;
          guideY = {
            type: 'horizontal',
            coordinate: ty,
            start: Math.min(currentMinX, target.x) - 15,
            end: Math.max(currentMaxX, target.x + target.width) + 15,
          };
        }
      }
    }
  }

  let finalDeltaX = rawDeltaX;
  let finalDeltaY = rawDeltaY;
  const guides: AlignmentGuide[] = [];

  if (bestDiffX !== null && guideX) {
    finalDeltaX += bestDiffX;
    guides.push(guideX);
  } else if (gridSize && gridSize > 0) {
    const nearestGridX = Math.round(currentMinX / gridSize) * gridSize;
    const diffGridX = nearestGridX - currentMinX;
    if (Math.abs(diffGridX) <= Math.min(snapThreshold, 5)) {
      finalDeltaX += diffGridX;
    }
  }

  if (bestDiffY !== null && guideY) {
    finalDeltaY += bestDiffY;
    guides.push(guideY);
  } else if (gridSize && gridSize > 0) {
    const nearestGridY = Math.round(currentMinY / gridSize) * gridSize;
    const diffGridY = nearestGridY - currentMinY;
    if (Math.abs(diffGridY) <= Math.min(snapThreshold, 5)) {
      finalDeltaY += diffGridY;
    }
  }

  return {
    snappedDeltaX: Math.round(finalDeltaX),
    snappedDeltaY: Math.round(finalDeltaY),
    guides,
  };
}
