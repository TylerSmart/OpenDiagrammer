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
