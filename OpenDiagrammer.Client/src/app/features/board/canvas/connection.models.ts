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
}

export interface InProgressConnection {
  sourceShapeId: string;
  sourceAnchor: AnchorPosition;
  currentPoint: CanvasPoint;
  targetShapeId?: string;
  targetAnchor?: AnchorPosition;
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
 * Generates an SVG path string for connection lines with various routing types.
 */
export function computeConnectionPath(
  start: CanvasPoint,
  end: CanvasPoint,
  routing: ConnectionRouting,
  sourceAnchor?: AnchorPosition,
  _targetAnchor?: AnchorPosition,
): string {
  if (routing === 'straight') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  if (routing === 'curved') {
    const dx = end.x - start.x;
    // Cubic bezier with horizontal controls based on start and end
    const cx1 = start.x + dx * 0.5;
    const cy1 = start.y;
    const cx2 = start.x + dx * 0.5;
    const cy2 = end.y;
    return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
  }

  // Orthogonal routing (step lines)
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  if (sourceAnchor === 'top' || sourceAnchor === 'bottom') {
    return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
  } else {
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }
}
