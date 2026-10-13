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
 * Computes orthogonal routing points for a self-loop on a shape.
 * Guarantees that the connector emerges cleanly from sourceAnchor,
 * routes around the exterior of the shape without entering its interior bounding box,
 * and enters cleanly through targetAnchor.
 */
export function computeSelfLoopOrthogonalPoints(
  start: CanvasPoint,
  end: CanvasPoint,
  sourceAnchor: AnchorPosition,
  targetAnchor: AnchorPosition,
  shapeBounds?: { x: number; y: number; width: number; height: number },
  stub = 28,
): CanvasPoint[] {
  const shapeLeft = shapeBounds ? shapeBounds.x : Math.min(start.x, end.x);
  const shapeRight = shapeBounds ? shapeBounds.x + shapeBounds.width : Math.max(start.x, end.x);
  const shapeTop = shapeBounds ? shapeBounds.y : Math.min(start.y, end.y);
  const shapeBottom = shapeBounds ? shapeBounds.y + shapeBounds.height : Math.max(start.y, end.y);

  const xLeft = shapeLeft - stub;
  const xRight = shapeRight + stub;
  const yTop = shapeTop - stub;
  const yBottom = shapeBottom + stub;

  switch (sourceAnchor) {
    case 'bottom':
      switch (targetAnchor) {
        case 'left':
          return [
            start,
            { x: start.x, y: yBottom },
            { x: xLeft, y: yBottom },
            { x: xLeft, y: end.y },
            end,
          ];
        case 'right':
          return [
            start,
            { x: start.x, y: yBottom },
            { x: xRight, y: yBottom },
            { x: xRight, y: end.y },
            end,
          ];
        case 'top':
          return [
            start,
            { x: start.x, y: yBottom },
            { x: xRight, y: yBottom },
            { x: xRight, y: yTop },
            { x: end.x, y: yTop },
            end,
          ];
        case 'bottom':
          return [start, end];
      }
      break;

    case 'top':
      switch (targetAnchor) {
        case 'left':
          return [
            start,
            { x: start.x, y: yTop },
            { x: xLeft, y: yTop },
            { x: xLeft, y: end.y },
            end,
          ];
        case 'right':
          return [
            start,
            { x: start.x, y: yTop },
            { x: xRight, y: yTop },
            { x: xRight, y: end.y },
            end,
          ];
        case 'bottom':
          return [
            start,
            { x: start.x, y: yTop },
            { x: xRight, y: yTop },
            { x: xRight, y: yBottom },
            { x: end.x, y: yBottom },
            end,
          ];
        case 'top':
          return [start, end];
      }
      break;

    case 'left':
      switch (targetAnchor) {
        case 'top':
          return [
            start,
            { x: xLeft, y: start.y },
            { x: xLeft, y: yTop },
            { x: end.x, y: yTop },
            end,
          ];
        case 'bottom':
          return [
            start,
            { x: xLeft, y: start.y },
            { x: xLeft, y: yBottom },
            { x: end.x, y: yBottom },
            end,
          ];
        case 'right':
          return [
            start,
            { x: xLeft, y: start.y },
            { x: xLeft, y: yBottom },
            { x: xRight, y: yBottom },
            { x: xRight, y: end.y },
            end,
          ];
        case 'left':
          return [start, end];
      }
      break;

    case 'right':
      switch (targetAnchor) {
        case 'top':
          return [
            start,
            { x: xRight, y: start.y },
            { x: xRight, y: yTop },
            { x: end.x, y: yTop },
            end,
          ];
        case 'bottom':
          return [
            start,
            { x: xRight, y: start.y },
            { x: xRight, y: yBottom },
            { x: end.x, y: yBottom },
            end,
          ];
        case 'left':
          return [
            start,
            { x: xRight, y: start.y },
            { x: xRight, y: yBottom },
            { x: xLeft, y: yBottom },
            { x: xLeft, y: end.y },
            end,
          ];
        case 'right':
          return [start, end];
      }
      break;
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
  shapeBounds?: { x: number; y: number; width: number; height: number },
  isSelfLoop?: boolean,
): { path: string; midpoint: CanvasPoint; points: CanvasPoint[] } {
  const selfLoop =
    isSelfLoop ??
    (Boolean(shapeBounds) &&
      Boolean(sourceAnchor) &&
      Boolean(targetAnchor) &&
      sourceAnchor !== targetAnchor);

  // Self-loop default path calculation (when no custom waypoints have been set)
  if (
    selfLoop &&
    sourceAnchor &&
    targetAnchor &&
    sourceAnchor !== targetAnchor &&
    (!waypoints || waypoints.length === 0)
  ) {
    const orthoPoints = computeSelfLoopOrthogonalPoints(
      start,
      end,
      sourceAnchor,
      targetAnchor,
      shapeBounds,
    );

    if (routing === 'orthogonal' || routing === 'straight') {
      let path = `M ${orthoPoints[0].x} ${orthoPoints[0].y}`;
      for (let i = 1; i < orthoPoints.length; i++) {
        path += ` L ${orthoPoints[i].x} ${orthoPoints[i].y}`;
      }

      let totalLength = 0;
      const segLengths: number[] = [];
      for (let i = 0; i < orthoPoints.length - 1; i++) {
        const len = Math.hypot(
          orthoPoints[i + 1].x - orthoPoints[i].x,
          orthoPoints[i + 1].y - orthoPoints[i].y,
        );
        segLengths.push(len);
        totalLength += len;
      }
      let mid: CanvasPoint = orthoPoints[0];
      if (totalLength > 0) {
        const halfLength = totalLength / 2;
        let accumulated = 0;
        for (let i = 0; i < segLengths.length; i++) {
          const segLen = segLengths[i];
          if (accumulated + segLen >= halfLength && segLen > 0) {
            const ratio = (halfLength - accumulated) / segLen;
            mid = {
              x: Math.round(orthoPoints[i].x + (orthoPoints[i + 1].x - orthoPoints[i].x) * ratio),
              y: Math.round(orthoPoints[i].y + (orthoPoints[i + 1].y - orthoPoints[i].y) * ratio),
            };
            break;
          }
          accumulated += segLen;
        }
      }
      return { path, midpoint: mid, points: orthoPoints };
    }

    if (routing === 'curved') {
      // Smooth Catmull-Rom spline passing around the exterior corners of the shape
      let path = `M ${orthoPoints[0].x} ${orthoPoints[0].y}`;
      const n = orthoPoints.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = i > 0 ? orthoPoints[i - 1] : orthoPoints[i];
        const p1 = orthoPoints[i];
        const p2 = orthoPoints[i + 1];
        const p3 = i + 2 < n ? orthoPoints[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x} ${p2.y}`;
      }
      const midIdx = Math.floor(orthoPoints.length / 2);
      return { path, midpoint: orthoPoints[midIdx], points: orthoPoints };
    }
  }

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
    function getAnchorNormal(anchor?: AnchorPosition): { dx: number; dy: number } | null {
      if (!anchor) return null;
      switch (anchor) {
        case 'top':
          return { dx: 0, dy: -1 };
        case 'bottom':
          return { dx: 0, dy: 1 };
        case 'left':
          return { dx: -1, dy: 0 };
        case 'right':
          return { dx: 1, dy: 0 };
      }
    }

    const startNormal = getAnchorNormal(sourceAnchor);
    const endNormal = getAnchorNormal(targetAnchor);

    if (pts.length === 2) {
      // Single continuous Bézier curve exiting perpendicular to shape anchors
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      const minStub = 28;
      const stubLen = Math.max(minStub, dist * 0.35);

      let cx1: number;
      let cy1: number;
      if (startNormal) {
        cx1 = start.x + startNormal.dx * stubLen;
        cy1 = start.y + startNormal.dy * stubLen;
      } else {
        cx1 = start.x + (end.x - start.x) * 0.35;
        cy1 = start.y;
      }

      let cx2: number;
      let cy2: number;
      if (endNormal) {
        cx2 = end.x + endNormal.dx * stubLen;
        cy2 = end.y + endNormal.dy * stubLen;
      } else {
        cx2 = end.x - (end.x - start.x) * 0.35;
        cy2 = end.y;
      }

      const path = `M ${start.x} ${start.y} C ${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${end.x} ${end.y}`;
      // Midpoint on cubic Bézier at t = 0.5
      const mid = {
        x: Math.round(0.125 * start.x + 0.375 * cx1 + 0.375 * cx2 + 0.125 * end.x),
        y: Math.round(0.125 * start.y + 0.375 * cy1 + 0.375 * cy2 + 0.125 * end.y),
      };
      return {
        path,
        midpoint: mid,
        points: pts,
      };
    } else {
      // Smooth Catmull-Rom to Cubic Bézier spline passing exactly through all waypoints,
      // with end tangents aligned along anchor normals for smooth tangent continuity
      const allSplinePts = [...pts];
      const n = allSplinePts.length;

      let path = `M ${allSplinePts[0].x} ${allSplinePts[0].y}`;
      for (let i = 0; i < n - 1; i++) {
        const p1 = allSplinePts[i];
        const p2 = allSplinePts[i + 1];

        // Segment distance for proportional tangent scaling
        const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const tangentScale = Math.max(28, segDist * 0.4);

        let cp1x: number;
        let cp1y: number;
        if (i === 0 && startNormal) {
          // Tangent at start points strictly outward normal to the source anchor
          cp1x = p1.x + startNormal.dx * tangentScale;
          cp1y = p1.y + startNormal.dy * tangentScale;
        } else {
          const p0 = i > 0 ? allSplinePts[i - 1] : p1;
          cp1x = p1.x + (p2.x - p0.x) / 6;
          cp1y = p1.y + (p2.y - p0.y) / 6;
        }

        let cp2x: number;
        let cp2y: number;
        if (i === n - 2 && endNormal) {
          // Tangent entering end points strictly outward normal to the target anchor
          cp2x = p2.x + endNormal.dx * tangentScale;
          cp2y = p2.y + endNormal.dy * tangentScale;
        } else {
          const p3 = i + 2 < n ? allSplinePts[i + 2] : p2;
          cp2x = p2.x - (p3.x - p1.x) / 6;
          cp2y = p2.y - (p3.y - p1.y) / 6;
        }

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
        const commonX =
          start.x <= end.x
            ? Math.min(start.x, end.x) - 2 * STUB
            : Math.max(start.x, end.x) + 2 * STUB;
        points = [
          start,
          pStartStub,
          { x: commonX, y: pStartStub.y },
          { x: commonX, y: pEndStub.y },
          pEndStub,
          end,
        ];
      }
    } else {
      // Source is vertical, target is horizontal ('left' | 'right') or unassigned
      const isTargetInSourceDirection =
        sourceAnchor === 'bottom' ? end.y >= pStartStub.y : end.y <= pStartStub.y;
      const isSourceEnteringTargetStub =
        targetAnchor === 'left'
          ? start.x <= pEndStub.x
          : targetAnchor === 'right'
            ? start.x >= pEndStub.x
            : true;

      if (isTargetInSourceDirection && isSourceEnteringTargetStub) {
        points = [start, { x: start.x, y: end.y }, end];
      } else {
        const midY = isTargetInSourceDirection ? (pStartStub.y + end.y) / 2 : pStartStub.y;
        points = [start, { x: start.x, y: midY }, { x: pEndStub.x, y: midY }, pEndStub, end];
      }
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
        const commonY =
          start.y <= end.y
            ? Math.min(start.y, end.y) - 2 * STUB
            : Math.max(start.y, end.y) + 2 * STUB;
        points = [
          start,
          pStartStub,
          { x: pStartStub.x, y: commonY },
          { x: pEndStub.x, y: commonY },
          pEndStub,
          end,
        ];
      }
    } else {
      // Source is horizontal, target is vertical ('top' | 'bottom') or unassigned
      const isTargetInSourceDirection =
        sourceAnchor === 'right' ? end.x >= pStartStub.x : end.x <= pStartStub.x;
      const isSourceEnteringTargetStub =
        targetAnchor === 'top'
          ? start.y <= pEndStub.y
          : targetAnchor === 'bottom'
            ? start.y >= pEndStub.y
            : true;

      if (isTargetInSourceDirection && isSourceEnteringTargetStub) {
        points = [start, { x: end.x, y: start.y }, end];
      } else {
        const midX = isTargetInSourceDirection ? (pStartStub.x + end.x) / 2 : pStartStub.x;
        points = [start, { x: midX, y: start.y }, { x: midX, y: pEndStub.y }, pEndStub, end];
      }
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
