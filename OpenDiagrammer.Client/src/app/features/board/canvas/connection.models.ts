import { CanvasPoint } from './canvas.models';
import { CanvasShape } from './shape.models';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ShapeAnchor {
  position: AnchorPosition;
  point: CanvasPoint;
}

export type ConnectionRouting = 'straight' | 'orthogonal' | 'curved';

export type ConnectionMarker = 'none' | 'arrow';

export type ConnectionPattern = 'solid' | 'dashed' | 'dotted';

export interface CanvasConnection {
  id: string;
  sourceShapeId: string;
  sourceAnchor: AnchorPosition;
  targetShapeId?: string;
  targetAnchor?: AnchorPosition;
  targetPoint?: CanvasPoint;
  routing: ConnectionRouting;
  strokeColor: string;
  strokeWidth: number;
  pattern: ConnectionPattern;
  endMarker: ConnectionMarker;
  startMarker?: ConnectionMarker;
  text?: string;
  waypoints?: CanvasPoint[];
}

export interface InProgressConnection {
  sourceShapeId: string;
  sourceAnchor: AnchorPosition;
  currentPoint: CanvasPoint;
  targetShapeId?: string;
  targetAnchor?: AnchorPosition;
}

export interface RenderedConnection {
  id: string;
  path: string;
  strokeColor: string;
  strokeWidth: number;
  pattern: ConnectionPattern;
  routing: ConnectionRouting;
  dashArray?: string;
  startMarker?: ConnectionMarker;
  endMarker: ConnectionMarker;
  startPoint: CanvasPoint;
  endPoint: CanvasPoint;
  midpoint: CanvasPoint;
  text?: string;
  waypoints: CanvasPoint[];
  points: CanvasPoint[];
}

export const CONNECTION_CONSTANTS = {
  DEFAULT_STROKE: '#333333',
  DEFAULT_STROKE_WIDTH: 2,
  ANCHOR_RADIUS: 5,
} as const;

/**
 * Calculates the world coordinate of a given anchor position on a shape.
 */
export function getShapeAnchorPoint(shape: CanvasShape, anchor: AnchorPosition): CanvasPoint {
  switch (anchor) {
    case 'top':
      return { x: shape.x + shape.width / 2, y: shape.y };
    case 'right':
      return { x: shape.x + shape.width, y: shape.y + shape.height / 2 };
    case 'bottom':
      return { x: shape.x + shape.width / 2, y: shape.y + shape.height };
    case 'left':
      return { x: shape.x, y: shape.y + shape.height / 2 };
  }
}

/**
 * Generates an SVG path string for connection lines with various routing types and waypoints.
 */
export function computeConnectionPath(
  start: CanvasPoint,
  end: CanvasPoint,
  routing: ConnectionRouting,
  sourceAnchor?: AnchorPosition,
  targetAnchor?: AnchorPosition,
  waypoints?: CanvasPoint[],
): { path: string; midpoint: CanvasPoint; points: CanvasPoint[] } {
  const pts = [start, ...(waypoints || []), end];

  if (routing === 'straight') {
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x} ${pts[i].y}`;
    }
    const midIdx = Math.floor(pts.length / 2);
    const mid =
      pts.length === 2 ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } : pts[midIdx];
    return { path, midpoint: mid, points: pts };
  }

  if (routing === 'curved') {
    if (pts.length === 2) {
      // Direct curved line between start and end
      let cx1: number;
      let cy1: number;
      let cx2: number;
      let cy2: number;

      if (sourceAnchor === 'left' || sourceAnchor === 'right') {
        const dx = (end.x - start.x) / 2;
        cx1 = start.x + dx;
        cy1 = start.y;
        cx2 = end.x - dx;
        cy2 = end.y;
      } else if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
        const dy = (end.y - start.y) / 2;
        cx1 = start.x;
        cy1 = start.y + dy;
        cx2 = end.x;
        cy2 = end.y - dy;
      } else {
        const dx = end.x - start.x;
        cx1 = start.x + dx * 0.5;
        cy1 = start.y;
        cx2 = start.x + dx * 0.5;
        cy2 = end.y;
      }

      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return {
        path: `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`,
        midpoint: mid,
        points: pts,
      };
    } else {
      // Smooth Catmull-Rom to Cubic Bézier spline passing exactly through all waypoints
      let path = `M ${pts[0].x} ${pts[0].y}`;
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i + 2 < n ? pts[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x} ${p2.y}`;
      }
      const midIdx = Math.floor(pts.length / 2);
      return { path, midpoint: pts[midIdx], points: pts };
    }
  }

  // Orthogonal routing (step lines)
  if (waypoints && waypoints.length > 0) {
    let path = `M ${pts[0].x} ${pts[0].y}`;
    const allStepPoints: CanvasPoint[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const pPrev = pts[i - 1];
      const pCurr = pts[i];
      const midX = (pPrev.x + pCurr.x) / 2;
      path += ` L ${midX} ${pPrev.y} L ${midX} ${pCurr.y} L ${pCurr.x} ${pCurr.y}`;
      allStepPoints.push({ x: midX, y: pPrev.y }, { x: midX, y: pCurr.y }, pCurr);
    }
    const midIdx = Math.floor(allStepPoints.length / 2);
    return { path, midpoint: allStepPoints[midIdx], points: allStepPoints };
  }

  // Anchor normal vectors & clearance stub distance (20px)
  const STUB = 20;

  function getAnchorOffset(point: CanvasPoint, anchor?: AnchorPosition): CanvasPoint {
    if (!anchor) return { ...point };
    switch (anchor) {
      case 'top':
        return { x: point.x, y: point.y - STUB };
      case 'bottom':
        return { x: point.x, y: point.y + STUB };
      case 'left':
        return { x: point.x - STUB, y: point.y };
      case 'right':
        return { x: point.x + STUB, y: point.y };
    }
  }

  const pStartStub = getAnchorOffset(start, sourceAnchor);
  const pEndStub = getAnchorOffset(end, targetAnchor);

  // When both anchors face the same direction, step around them
  if (sourceAnchor && targetAnchor && sourceAnchor === targetAnchor) {
    let commonCoord: number;
    let points: CanvasPoint[];

    if (sourceAnchor === 'bottom') {
      commonCoord = Math.max(start.y, end.y) + STUB;
      points = [start, { x: start.x, y: commonCoord }, { x: end.x, y: commonCoord }, end];
    } else if (sourceAnchor === 'top') {
      commonCoord = Math.min(start.y, end.y) - STUB;
      points = [start, { x: start.x, y: commonCoord }, { x: end.x, y: commonCoord }, end];
    } else if (sourceAnchor === 'left') {
      commonCoord = Math.min(start.x, end.x) - STUB;
      points = [start, { x: commonCoord, y: start.y }, { x: commonCoord, y: end.y }, end];
    } else {
      // right
      commonCoord = Math.max(start.x, end.x) + STUB;
      points = [start, { x: commonCoord, y: start.y }, { x: commonCoord, y: end.y }, end];
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    const mid = {
      x: (points[1].x + points[2].x) / 2,
      y: (points[1].y + points[2].y) / 2,
    };
    return { path, midpoint: mid, points };
  }

  // Opposite anchors facing each other or general orthogonal routing
  let points: CanvasPoint[];
  if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
    if (targetAnchor === 'top' || targetAnchor === 'bottom') {
      // Both vertical
      const midY = (pStartStub.y + pEndStub.y) / 2;
      points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
    } else {
      // Source is vertical, target is horizontal or unassigned
      points = [start, { x: start.x, y: end.y }, end];
    }
  } else if (sourceAnchor === 'left' || sourceAnchor === 'right') {
    if (targetAnchor === 'left' || targetAnchor === 'right') {
      // Both horizontal
      const midX = (pStartStub.x + pEndStub.x) / 2;
      points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    } else {
      // Source is horizontal, target is vertical or unassigned
      points = [start, { x: end.x, y: start.y }, end];
    }
  } else {
    // Default midpoint step
    const midX = (start.x + end.x) / 2;
    points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  const midIdx = Math.floor(points.length / 2);
  const mid =
    points.length >= 4
      ? { x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2 }
      : points[midIdx];

  return { path, midpoint: mid, points };
}
