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
  _targetAnchor?: AnchorPosition,
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
      const dx = end.x - start.x;
      const cx1 = start.x + dx * 0.5;
      const cy1 = start.y;
      const cx2 = start.x + dx * 0.5;
      const cy2 = end.y;
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return {
        path: `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`,
        midpoint: mid,
        points: pts,
      };
    } else {
      // Curved spline through waypoints using quadratic/cubic segments
      let path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const mx = (p0.x + p1.x) / 2;
        const my = (p0.y + p1.y) / 2;
        path += ` Q ${p0.x} ${p0.y}, ${mx} ${my} T ${p1.x} ${p1.y}`;
      }
      const midIdx = Math.floor(pts.length / 2);
      return { path, midpoint: pts[midIdx], points: pts };
    }
  }

  // Orthogonal routing (step lines)
  if (waypoints && waypoints.length > 0) {
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const pPrev = pts[i - 1];
      const pCurr = pts[i];
      const midX = (pPrev.x + pCurr.x) / 2;
      path += ` L ${midX} ${pPrev.y} L ${midX} ${pCurr.y} L ${pCurr.x} ${pCurr.y}`;
    }
    const midIdx = Math.floor(pts.length / 2);
    return { path, midpoint: pts[midIdx], points: pts };
  }

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  let path: string;
  let mid: CanvasPoint;

  if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
    path = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
    mid = { x: (start.x + end.x) / 2, y: midY };
  } else {
    path = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    mid = { x: midX, y: (start.y + end.y) / 2 };
  }

  return { path, midpoint: mid, points: [start, mid, end] };
}
