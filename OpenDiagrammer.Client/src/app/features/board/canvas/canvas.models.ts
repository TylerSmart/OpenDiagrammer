export interface CanvasTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasViewportBounds {
  width: number;
  height: number;
}

export const CANVAS_CONSTANTS = {
  MIN_ZOOM: 0.1, // 10%
  MAX_ZOOM: 5.0, // 500%
  DEFAULT_ZOOM: 1.0, // 100%
  ZOOM_STEP: 0.1,
  GRID_SIZE: 32,
  DOT_GRID_SIZE: 24,
} as const;
