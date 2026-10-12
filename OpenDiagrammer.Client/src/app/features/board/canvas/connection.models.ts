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

export interface ConnectionSegment {
  index: number;
  orientation: 'horizontal' | 'vertical';
  midpoint: CanvasPoint;
  start: CanvasPoint;
  end: CanvasPoint;
  length: number;
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
  segments: ConnectionSegment[];
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
    let totalLength = 0;
    const segLengths: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segLengths.push(len);
      totalLength += len;
    }
    let mid: CanvasPoint = pts[0];
    if (totalLength > 0) {
      const halfLength = totalLength / 2;
      let accumulated = 0;
      for (let i = 0; i < segLengths.length; i++) {
        const segLen = segLengths[i];
        if (accumulated + segLen >= halfLength && segLen > 0) {
          const ratio = (halfLength - accumulated) / segLen;
          mid = {
            x: Math.round(pts[i].x + (pts[i + 1].x - pts[i].x) * ratio),
            y: Math.round(pts[i].y + (pts[i + 1].y - pts[i].y) * ratio),
          };
          break;
        }
        accumulated += segLen;
      }
    }
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

  let points: CanvasPoint[];

  if (waypoints && waypoints.length > 0) {
    // If explicit waypoints are defined, route orthogonally with initial stubs
    const allPts = [start, pStartStub, ...waypoints, pEndStub, end];
    points = [start];
    for (let i = 1; i < allPts.length; i++) {
      const pPrev = allPts[i - 1];
      const pCurr = allPts[i];
      if (!pPrev || !pCurr) continue;
      // If segment is diagonal, make an orthogonal step between them
      if (Math.abs(pPrev.x - pCurr.x) > 1 && Math.abs(pPrev.y - pCurr.y) > 1) {
        // Step according to dominant direction or anchor orientation
        const midX = (pPrev.x + pCurr.x) / 2;
        points.push({ x: midX, y: pPrev.y });
        points.push({ x: midX, y: pCurr.y });
      }
      points.push(pCurr);
    }
  } else if (sourceAnchor && targetAnchor && sourceAnchor === targetAnchor) {
    // When both anchors face the same direction, step around them
    let commonCoord: number;
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
  } else if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
    if (targetAnchor === 'top' || targetAnchor === 'bottom') {
      // Both vertical (e.g. top to bottom or bottom to top)
      const isOpposite =
        (sourceAnchor === 'bottom' && targetAnchor === 'top' && end.y >= start.y + 2 * STUB) ||
        (sourceAnchor === 'top' && targetAnchor === 'bottom' && start.y >= end.y + 2 * STUB);

      if (isOpposite) {
        // Direct vertical step between anchors with clearance
        const midY = (start.y + end.y) / 2;
        points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
      } else {
        // Target is behind or overlapping: step out through stubs then around
        const midY = (pStartStub.y + pEndStub.y) / 2;
        points = [start, pStartStub, { x: start.x, y: midY }, { x: end.x, y: midY }, pEndStub, end];
      }
    } else {
      // Source is vertical, target is horizontal or unassigned
      // Must come straight out of sourceAnchor by at least STUB length
      points = [start, pStartStub, { x: start.x, y: end.y }, end];
    }
  } else if (sourceAnchor === 'left' || sourceAnchor === 'right') {
    if (targetAnchor === 'left' || targetAnchor === 'right') {
      // Both horizontal (e.g. right to left or left to right)
      const isOpposite =
        (sourceAnchor === 'right' && targetAnchor === 'left' && end.x >= start.x + 2 * STUB) ||
        (sourceAnchor === 'left' && targetAnchor === 'right' && start.x >= end.x + 2 * STUB);

      if (isOpposite) {
        // Direct horizontal step between anchors with clearance
        const midX = (start.x + end.x) / 2;
        points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
      } else {
        // Target is behind or overlapping: step out through stubs then around
        const midX = (pStartStub.x + pEndStub.x) / 2;
        points = [start, pStartStub, { x: midX, y: start.y }, { x: midX, y: end.y }, pEndStub, end];
      }
    } else {
      // Source is horizontal, target is vertical or unassigned
      // Must come straight out of sourceAnchor by at least STUB length
      points = [start, pStartStub, { x: end.x, y: start.y }, end];
    }
  } else {
    // Default midpoint step
    const midX = (start.x + end.x) / 2;
    points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }

  // Simplify collinear points (with 4px tolerance so close alignments merge cleanly)
  const COLLINEAR_TOLERANCE = 4;
  const simplified: CanvasPoint[] = [];
  for (const pt of points) {
    if (simplified.length >= 2) {
      const p1 = simplified[simplified.length - 2];
      const p2 = simplified[simplified.length - 1];
      // Check if p1, p2, pt are collinear within tolerance
      if (
        (Math.abs(p1.x - p2.x) <= COLLINEAR_TOLERANCE &&
          Math.abs(p2.x - pt.x) <= COLLINEAR_TOLERANCE) ||
        (Math.abs(p1.y - p2.y) <= COLLINEAR_TOLERANCE &&
          Math.abs(p2.y - pt.y) <= COLLINEAR_TOLERANCE)
      ) {
        // Replace p2 with pt to collapse intermediate collinear bend
        simplified[simplified.length - 1] = pt;
        continue;
      }
    }
    simplified.push(pt);
  }
  points = simplified.length >= 2 ? simplified : points;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  // Calculate true midpoint along total polyline length
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(len);
    totalLength += len;
  }

  let mid: CanvasPoint = points[0];
  if (totalLength > 0) {
    const halfLength = totalLength / 2;
    let accumulated = 0;
    for (let i = 0; i < segLengths.length; i++) {
      const segLen = segLengths[i];
      if (accumulated + segLen >= halfLength && segLen > 0) {
        const remaining = halfLength - accumulated;
        const ratio = remaining / segLen;
        mid = {
          x: Math.round(points[i].x + (points[i + 1].x - points[i].x) * ratio),
          y: Math.round(points[i].y + (points[i + 1].y - points[i].y) * ratio),
        };
        break;
      }
      accumulated += segLen;
    }
  }

  return { path, midpoint: mid, points };
}

/**
 * Extracts orthogonal or straight segments suitable for Miro-style reshaping handles.
 * Only segments that meet minLength (default 30px) are included.
 */
export function extractConnectionSegments(
  points: CanvasPoint[],
  minLength = 30,
): ConnectionSegment[] {
  const segments: ConnectionSegment[] = [];
  if (!points || points.length < 2) return segments;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;

    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    if (length < minLength) continue;

    const orientation = dx >= dy ? 'horizontal' : 'vertical';
    const midpoint: CanvasPoint = {
      x: Math.round((p1.x + p2.x) / 2),
      y: Math.round((p1.y + p2.y) / 2),
    };

    segments.push({
      index: i,
      orientation,
      midpoint,
      start: p1,
      end: p2,
      length,
    });
  }

  return segments;
}
