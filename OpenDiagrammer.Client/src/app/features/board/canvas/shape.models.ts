export type ShapeCategory = 'basic' | 'flowchart' | 'uml';

export type ShapeType =
  // Basic Shapes
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'text-block'
  // Flowchart
  | 'flowchart-process'
  | 'flowchart-decision'
  | 'flowchart-terminal'
  | 'flowchart-io'
  | 'flowchart-document'
  | 'flowchart-database'
  // UML
  | 'uml-class'
  | 'uml-interface'
  | 'uml-actor'
  | 'uml-usecase'
  | 'uml-package'
  // Sticky note
  | 'sticky-note'
  | 'sticky-pad'
  // Frames & Pages
  | 'frame';

export interface CatalogShapeItem {
  type: ShapeType;
  category: ShapeCategory;
  label: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultText?: string;
}

export const SHAPE_CATALOG: CatalogShapeItem[] = [
  // Basic
  {
    type: 'rectangle',
    category: 'basic',
    label: 'Rectangle',
    icon: 'crop_square',
    defaultWidth: 120,
    defaultHeight: 80,
  },
  {
    type: 'rounded-rectangle',
    category: 'basic',
    label: 'Rounded Rectangle',
    icon: 'square',
    defaultWidth: 120,
    defaultHeight: 80,
  },
  {
    type: 'ellipse',
    category: 'basic',
    label: 'Circle / Ellipse',
    icon: 'panorama_fish_eye',
    defaultWidth: 100,
    defaultHeight: 100,
  },
  {
    type: 'diamond',
    category: 'basic',
    label: 'Diamond',
    icon: 'change_history',
    defaultWidth: 110,
    defaultHeight: 110,
  },
  {
    type: 'triangle',
    category: 'basic',
    label: 'Triangle',
    icon: 'play_arrow',
    defaultWidth: 100,
    defaultHeight: 90,
  },
  {
    type: 'text-block',
    category: 'basic',
    label: 'Text Block',
    icon: 'title',
    defaultWidth: 120,
    defaultHeight: 40,
    defaultText: 'Text Note',
  },

  // Flowchart
  {
    type: 'flowchart-process',
    category: 'flowchart',
    label: 'Process',
    icon: 'check_box_outline_blank',
    defaultWidth: 130,
    defaultHeight: 70,
    defaultText: 'Process',
  },
  {
    type: 'flowchart-decision',
    category: 'flowchart',
    label: 'Decision',
    icon: 'diamond',
    defaultWidth: 120,
    defaultHeight: 90,
    defaultText: 'Decision',
  },
  {
    type: 'flowchart-terminal',
    category: 'flowchart',
    label: 'Start / End',
    icon: 'stadium',
    defaultWidth: 130,
    defaultHeight: 60,
    defaultText: 'Start',
  },
  {
    type: 'flowchart-io',
    category: 'flowchart',
    label: 'Input / Output',
    icon: 'input',
    defaultWidth: 130,
    defaultHeight: 70,
    defaultText: 'Input / Output',
  },
  {
    type: 'flowchart-document',
    category: 'flowchart',
    label: 'Document',
    icon: 'description',
    defaultWidth: 120,
    defaultHeight: 80,
    defaultText: 'Document',
  },
  {
    type: 'flowchart-database',
    category: 'flowchart',
    label: 'Database',
    icon: 'storage',
    defaultWidth: 100,
    defaultHeight: 90,
    defaultText: 'Database',
  },

  // UML
  {
    type: 'uml-class',
    category: 'uml',
    label: 'UML Class',
    icon: 'view_agenda',
    defaultWidth: 160,
    defaultHeight: 92,
    defaultText: 'ClassName\n---\n+ attribute: type\n---\n+ method(): void',
  },
  {
    type: 'uml-interface',
    category: 'uml',
    label: 'UML Interface',
    icon: 'integration_instructions',
    defaultWidth: 150,
    defaultHeight: 80,
    defaultText: '«interface»\nInterfaceName\n---\n+ operation()',
  },
  {
    type: 'uml-actor',
    category: 'uml',
    label: 'UML Actor',
    icon: 'person',
    defaultWidth: 60,
    defaultHeight: 90,
    defaultText: 'Actor',
  },
  {
    type: 'uml-usecase',
    category: 'uml',
    label: 'UML Use Case',
    icon: 'radio_button_unchecked',
    defaultWidth: 130,
    defaultHeight: 70,
    defaultText: 'Use Case',
  },
  {
    type: 'uml-package',
    category: 'uml',
    label: 'UML Package',
    icon: 'folder',
    defaultWidth: 150,
    defaultHeight: 100,
    defaultText: 'Package',
  },
  {
    type: 'sticky-note',
    category: 'basic',
    label: 'Sticky Note',
    icon: 'sticky_note_2',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultText: 'Note',
  },
  {
    type: 'sticky-pad',
    category: 'basic',
    label: 'Sticky Note Pad',
    icon: 'note_stack',
    defaultWidth: 130,
    defaultHeight: 130,
    defaultText: 'Sticky Pad',
  },
  {
    type: 'frame',
    category: 'basic',
    label: 'Frame / Page',
    icon: 'crop_free',
    defaultWidth: 800,
    defaultHeight: 600,
    defaultText: 'Frame 1',
  },
];

export interface FramePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: string;
  description?: string;
}

export const FRAME_PRESETS: FramePreset[] = [
  {
    id: 'custom',
    name: 'Custom Frame',
    width: 800,
    height: 600,
    icon: 'crop_free',
    description: '800 × 600',
  },
  {
    id: 'presentation-16-9',
    name: 'Presentation (16:9)',
    width: 1920,
    height: 1080,
    icon: 'slideshow',
    description: '1920 × 1080 (HD)',
  },
  {
    id: 'presentation-4-3',
    name: 'Presentation (4:3)',
    width: 1024,
    height: 768,
    icon: 'present_to_all',
    description: '1024 × 768 (Standard)',
  },
  {
    id: 'desktop',
    name: 'Desktop Display',
    width: 1440,
    height: 900,
    icon: 'desktop_windows',
    description: '1440 × 900',
  },
  {
    id: 'tablet',
    name: 'Tablet Screen',
    width: 768,
    height: 1024,
    icon: 'tablet',
    description: '768 × 1024 (iPad)',
  },
  {
    id: 'mobile',
    name: 'Mobile Phone',
    width: 375,
    height: 812,
    icon: 'smartphone',
    description: '375 × 812 (Phone)',
  },
  {
    id: 'a4',
    name: 'A4 Document',
    width: 842,
    height: 595,
    icon: 'article',
    description: '842 × 595 (Landscape)',
  },
];

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
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  authorName?: string;
  showAuthor?: boolean;
  zIndex: number;
  locked?: boolean;
  groupId?: string;
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

export type ActiveTool = 'select' | 'connection' | ShapeType;

export interface CanvasColorPreset {
  id: string;
  label: string;
  fill: string;
  stroke: string;
  swatch: string;
}

export const STICKY_NOTE_COLORS: CanvasColorPreset[] = [
  {
    id: 'yellow',
    label: 'Yellow',
    fill: 'var(--canvas-color-amber-fill)',
    stroke: 'var(--canvas-color-amber-stroke)',
    swatch: 'var(--canvas-color-amber-stroke)',
  },
  {
    id: 'green',
    label: 'Green',
    fill: 'var(--canvas-color-green-fill)',
    stroke: 'var(--canvas-color-green-stroke)',
    swatch: 'var(--canvas-color-green-stroke)',
  },
  {
    id: 'pink',
    label: 'Pink',
    fill: 'var(--canvas-color-pink-fill)',
    stroke: 'var(--canvas-color-pink-stroke)',
    swatch: 'var(--canvas-color-pink-stroke)',
  },
  {
    id: 'blue',
    label: 'Blue',
    fill: 'var(--canvas-color-blue-fill)',
    stroke: 'var(--canvas-color-blue-stroke)',
    swatch: 'var(--canvas-color-blue-stroke)',
  },
  {
    id: 'purple',
    label: 'Purple',
    fill: 'var(--canvas-color-purple-fill)',
    stroke: 'var(--canvas-color-purple-stroke)',
    swatch: 'var(--canvas-color-purple-stroke)',
  },
  {
    id: 'orange',
    label: 'Orange',
    fill: 'var(--canvas-color-orange-fill)',
    stroke: 'var(--canvas-color-orange-stroke)',
    swatch: 'var(--canvas-color-orange-stroke)',
  },
  {
    id: 'teal',
    label: 'Teal',
    fill: 'var(--canvas-color-teal-fill)',
    stroke: 'var(--canvas-color-teal-stroke)',
    swatch: 'var(--canvas-color-teal-stroke)',
  },
];

export const CANVAS_COLOR_PRESETS: CanvasColorPreset[] = [
  {
    id: 'default',
    label: 'Neutral',
    fill: 'var(--canvas-color-default-fill)',
    stroke: 'var(--canvas-color-default-stroke)',
    swatch: 'var(--canvas-color-default-stroke)',
  },
  {
    id: 'inverse',
    label: 'Inverse',
    fill: 'var(--canvas-color-inverse-fill)',
    stroke: 'var(--canvas-color-inverse-stroke)',
    swatch: 'var(--canvas-color-inverse-fill)',
  },
  {
    id: 'blue',
    label: 'Blue',
    fill: 'var(--canvas-color-blue-fill)',
    stroke: 'var(--canvas-color-blue-stroke)',
    swatch: 'var(--canvas-color-blue-stroke)',
  },
  {
    id: 'teal',
    label: 'Teal',
    fill: 'var(--canvas-color-teal-fill)',
    stroke: 'var(--canvas-color-teal-stroke)',
    swatch: 'var(--canvas-color-teal-stroke)',
  },
  {
    id: 'green',
    label: 'Green',
    fill: 'var(--canvas-color-green-fill)',
    stroke: 'var(--canvas-color-green-stroke)',
    swatch: 'var(--canvas-color-green-stroke)',
  },
  {
    id: 'lime',
    label: 'Lime',
    fill: 'var(--canvas-color-lime-fill)',
    stroke: 'var(--canvas-color-lime-stroke)',
    swatch: 'var(--canvas-color-lime-stroke)',
  },
  {
    id: 'yellow',
    label: 'Yellow',
    fill: 'var(--canvas-color-yellow-fill)',
    stroke: 'var(--canvas-color-yellow-stroke)',
    swatch: 'var(--canvas-color-yellow-stroke)',
  },
  {
    id: 'amber',
    label: 'Amber',
    fill: 'var(--canvas-color-amber-fill)',
    stroke: 'var(--canvas-color-amber-stroke)',
    swatch: 'var(--canvas-color-amber-stroke)',
  },
  {
    id: 'orange',
    label: 'Orange',
    fill: 'var(--canvas-color-orange-fill)',
    stroke: 'var(--canvas-color-orange-stroke)',
    swatch: 'var(--canvas-color-orange-stroke)',
  },
  {
    id: 'red',
    label: 'Red',
    fill: 'var(--canvas-color-red-fill)',
    stroke: 'var(--canvas-color-red-stroke)',
    swatch: 'var(--canvas-color-red-stroke)',
  },
  {
    id: 'pink',
    label: 'Pink',
    fill: 'var(--canvas-color-pink-fill)',
    stroke: 'var(--canvas-color-pink-stroke)',
    swatch: 'var(--canvas-color-pink-stroke)',
  },
  {
    id: 'purple',
    label: 'Purple',
    fill: 'var(--canvas-color-purple-fill)',
    stroke: 'var(--canvas-color-purple-stroke)',
    swatch: 'var(--canvas-color-purple-stroke)',
  },
];

export const SHAPE_CONSTANTS = {
  MIN_WIDTH: 30,
  MIN_HEIGHT: 30,
  DEFAULT_WIDTH: 120,
  DEFAULT_HEIGHT: 80,
  DEFAULT_FILL: 'var(--canvas-color-default-fill)',
  DEFAULT_STROKE: 'var(--canvas-color-default-stroke)',
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

export interface ResizeSnappingResult {
  newX: number;
  newY: number;
  newWidth: number;
  newHeight: number;
  guides: AlignmentGuide[];
}

/**
 * Computes snapped dimensions and alignment guidelines when resizing a shape relative to other shapes or a grid.
 */
export function computeShapeResizeSnapping(
  init: CanvasShape,
  handle: ResizeHandlePosition,
  rawDeltaX: number,
  rawDeltaY: number,
  targetShapes: CanvasShape[],
  snapThreshold = 8,
  maintainAspectRatio = false,
  keep1to1 = false,
): ResizeSnappingResult {
  let newX = init.x;
  let newY = init.y;
  let newWidth = init.width;
  let newHeight = init.height;

  // 1. Compute raw proposed bounds based on handle
  if (handle.includes('e')) {
    newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, init.width + rawDeltaX);
  } else if (handle.includes('w')) {
    const potentialWidth = init.width - rawDeltaX;
    if (potentialWidth >= SHAPE_CONSTANTS.MIN_WIDTH) {
      newWidth = potentialWidth;
      newX = init.x + rawDeltaX;
    } else {
      newWidth = SHAPE_CONSTANTS.MIN_WIDTH;
      newX = init.x + (init.width - SHAPE_CONSTANTS.MIN_WIDTH);
    }
  }

  if (handle.includes('s')) {
    newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, init.height + rawDeltaY);
  } else if (handle.includes('n')) {
    const potentialHeight = init.height - rawDeltaY;
    if (potentialHeight >= SHAPE_CONSTANTS.MIN_HEIGHT) {
      newHeight = potentialHeight;
      newY = init.y + rawDeltaY;
    } else {
      newHeight = SHAPE_CONSTANTS.MIN_HEIGHT;
      newY = init.y + (init.height - SHAPE_CONSTANTS.MIN_HEIGHT);
    }
  }

  // 2. Identify active moving coordinate for X and Y
  const movingX = handle.includes('e') ? init.x + newWidth : handle.includes('w') ? newX : null;
  const movingY = handle.includes('s') ? init.y + newHeight : handle.includes('n') ? newY : null;

  let bestDiffX: number | null = null;
  let bestDistX = Infinity;
  let matchedTargetX: CanvasShape | null = null;
  let snapCoordX: number | null = null;

  if (movingX !== null) {
    for (const target of targetShapes) {
      const targetXs = [target.x, target.x + target.width / 2, target.x + target.width];
      for (const tx of targetXs) {
        const diff = tx - movingX;
        const dist = Math.abs(diff);
        if (dist <= snapThreshold && dist < bestDistX) {
          bestDistX = dist;
          bestDiffX = diff;
          matchedTargetX = target;
          snapCoordX = tx;
        }
      }
    }
  }

  let bestDiffY: number | null = null;
  let bestDistY = Infinity;
  let matchedTargetY: CanvasShape | null = null;
  let snapCoordY: number | null = null;

  if (movingY !== null) {
    for (const target of targetShapes) {
      const targetYs = [target.y, target.y + target.height / 2, target.y + target.height];
      for (const ty of targetYs) {
        const diff = ty - movingY;
        const dist = Math.abs(diff);
        if (dist <= snapThreshold && dist < bestDistY) {
          bestDistY = dist;
          bestDiffY = diff;
          matchedTargetY = target;
          snapCoordY = ty;
        }
      }
    }
  }

  const guides: AlignmentGuide[] = [];

  // 3. Apply snapping according to constraints
  if (keep1to1) {
    // 1:1 square/circle: decide which axis controls
    const useX = bestDiffX !== null && (bestDiffY === null || bestDistX <= bestDistY);
    const useY = !useX && bestDiffY !== null;

    if (useX && bestDiffX !== null) {
      if (handle.includes('e')) {
        newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, newWidth + bestDiffX);
      } else if (handle.includes('w')) {
        const potW = newWidth - bestDiffX;
        if (potW >= SHAPE_CONSTANTS.MIN_WIDTH) {
          newWidth = potW;
          newX = newX + bestDiffX;
        }
      }
      newHeight = newWidth;
      if (handle.includes('n')) {
        newY = init.y + (init.height - newHeight);
      }
      if (matchedTargetX && snapCoordX !== null) {
        guides.push({
          type: 'vertical',
          coordinate: snapCoordX,
          start: Math.min(newY, matchedTargetX.y) - 15,
          end: Math.max(newY + newHeight, matchedTargetX.y + matchedTargetX.height) + 15,
        });
      }
    } else if (useY && bestDiffY !== null) {
      if (handle.includes('s')) {
        newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, newHeight + bestDiffY);
      } else if (handle.includes('n')) {
        const potH = newHeight - bestDiffY;
        if (potH >= SHAPE_CONSTANTS.MIN_HEIGHT) {
          newHeight = potH;
          newY = newY + bestDiffY;
        }
      }
      newWidth = newHeight;
      if (handle.includes('w')) {
        newX = init.x + (init.width - newWidth);
      }
      if (matchedTargetY && snapCoordY !== null) {
        guides.push({
          type: 'horizontal',
          coordinate: snapCoordY,
          start: Math.min(newX, matchedTargetY.x) - 15,
          end: Math.max(newX + newWidth, matchedTargetY.x + matchedTargetY.width) + 15,
        });
      }
    } else {
      if (handle === 'e' || handle === 'w') {
        newHeight = newWidth;
      } else if (handle === 'n' || handle === 's') {
        newWidth = newHeight;
      } else {
        const side = Math.max(newWidth, newHeight);
        if (handle.includes('w')) {
          newX = init.x + (init.width - side);
        }
        if (handle.includes('n')) {
          newY = init.y + (init.height - side);
        }
        newWidth = side;
        newHeight = side;
      }
    }
  } else if (maintainAspectRatio && init.width > 0 && init.height > 0) {
    const aspectRatio = init.width / init.height;
    const useX = bestDiffX !== null && (bestDiffY === null || bestDistX <= bestDistY);
    const useY = !useX && bestDiffY !== null;

    if (useX && bestDiffX !== null) {
      if (handle.includes('e')) {
        newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, newWidth + bestDiffX);
      } else if (handle.includes('w')) {
        const potW = newWidth - bestDiffX;
        if (potW >= SHAPE_CONSTANTS.MIN_WIDTH) {
          newWidth = potW;
          newX = newX + bestDiffX;
        }
      }
      newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, newWidth / aspectRatio);
      if (handle.includes('n')) {
        newY = init.y + (init.height - newHeight);
      }
      if (matchedTargetX && snapCoordX !== null) {
        guides.push({
          type: 'vertical',
          coordinate: snapCoordX,
          start: Math.min(newY, matchedTargetX.y) - 15,
          end: Math.max(newY + newHeight, matchedTargetX.y + matchedTargetX.height) + 15,
        });
      }
    } else if (useY && bestDiffY !== null) {
      if (handle.includes('s')) {
        newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, newHeight + bestDiffY);
      } else if (handle.includes('n')) {
        const potH = newHeight - bestDiffY;
        if (potH >= SHAPE_CONSTANTS.MIN_HEIGHT) {
          newHeight = potH;
          newY = newY + bestDiffY;
        }
      }
      newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, newHeight * aspectRatio);
      if (handle.includes('w')) {
        newX = init.x + (init.width - newWidth);
      }
      if (matchedTargetY && snapCoordY !== null) {
        guides.push({
          type: 'horizontal',
          coordinate: snapCoordY,
          start: Math.min(newX, matchedTargetY.x) - 15,
          end: Math.max(newX + newWidth, matchedTargetY.x + matchedTargetY.width) + 15,
        });
      }
    } else {
      if (handle === 'e' || handle === 'w') {
        newHeight = newWidth / aspectRatio;
      } else if (handle === 'n' || handle === 's') {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
        if (handle.includes('n')) {
          newY = init.y + (init.height - newHeight);
        }
      }
    }
  } else {
    // Standard unconstrained resize
    if (bestDiffX !== null) {
      if (handle.includes('e')) {
        newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, newWidth + bestDiffX);
      } else if (handle.includes('w')) {
        const potW = newWidth - bestDiffX;
        if (potW >= SHAPE_CONSTANTS.MIN_WIDTH) {
          newWidth = potW;
          newX = newX + bestDiffX;
        }
      }
    }

    if (bestDiffY !== null) {
      if (handle.includes('s')) {
        newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, newHeight + bestDiffY);
      } else if (handle.includes('n')) {
        const potH = newHeight - bestDiffY;
        if (potH >= SHAPE_CONSTANTS.MIN_HEIGHT) {
          newHeight = potH;
          newY = newY + bestDiffY;
        }
      }
    }

    if (matchedTargetX && snapCoordX !== null) {
      guides.push({
        type: 'vertical',
        coordinate: snapCoordX,
        start: Math.min(newY, matchedTargetX.y) - 15,
        end: Math.max(newY + newHeight, matchedTargetX.y + matchedTargetX.height) + 15,
      });
    }

    if (matchedTargetY && snapCoordY !== null) {
      guides.push({
        type: 'horizontal',
        coordinate: snapCoordY,
        start: Math.min(newX, matchedTargetY.x) - 15,
        end: Math.max(newX + newWidth, matchedTargetY.x + matchedTargetY.width) + 15,
      });
    }
  }

  return {
    newX: Math.round(newX),
    newY: Math.round(newY),
    newWidth: Math.round(newWidth),
    newHeight: Math.round(newHeight),
    guides,
  };
}

/**
 * Computes an auto-fitting font size that scales down to fit available width and height,
 * stopping at a minimum font size (default 10px).
 */
export function computeFittingFontSize(
  text: string | undefined | null,
  width: number,
  height: number,
  baseSize = 14,
  minSize = 10,
): number {
  if (!text) {
    return baseSize;
  }
  const plain = text.replace(/<[^>]+>/g, '').trim();
  if (!plain) {
    return baseSize;
  }
  const lines = plain.split(/\r?\n/).length;
  const chars = plain.length;
  const usableWidth = Math.max(20, width - 24);
  const usableHeight = Math.max(20, height - 20);

  let size = baseSize;
  while (size > minSize) {
    const charsPerLine = Math.floor(usableWidth / (size * 0.55));
    const estimatedLines = Math.max(lines, Math.ceil(chars / Math.max(1, charsPerLine)));
    const neededHeight = estimatedLines * (size * 1.35);
    if (neededHeight <= usableHeight) {
      break;
    }
    size -= 1;
  }
  return Math.max(minSize, size);
}

/**
 * Cleans user-entered rich text HTML to ensure safe display without malicious scripts.
 */
export function sanitizeRichText(html: string | undefined | null): string {
  if (!html) {
    return '';
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export interface UmlClassSections {
  className: string;
  attributes: string;
  methods: string;
}

export function parseUmlClassText(text: string | undefined | null): UmlClassSections {
  if (!text) {
    return { className: 'ClassName', attributes: '+ attribute: type', methods: '+ method(): void' };
  }
  const parts = text.split(/(?:\r?\n)?[ \t]*(?:---|<hr\s*\/?>)[ \t]*(?:\r?\n)?/);
  return {
    className: parts[0] ?? '',
    attributes: parts[1] ?? '',
    methods: parts.slice(2).join('\n---\n') ?? '',
  };
}

export function formatUmlClassText(sections: UmlClassSections): string {
  return `${sections.className}\n---\n${sections.attributes}\n---\n${sections.methods}`;
}

export interface UmlInterfaceSections {
  interfaceName: string;
  methods: string;
}

export function parseUmlInterfaceText(text: string | undefined | null): UmlInterfaceSections {
  if (!text) {
    return { interfaceName: '«interface»\nInterfaceName', methods: '+ operation()' };
  }
  const parts = text.split(/(?:\r?\n)?[ \t]*(?:---|<hr\s*\/?>)[ \t]*(?:\r?\n)?/);
  return {
    interfaceName: parts[0] ?? '',
    methods: parts.slice(1).join('\n---\n') ?? '',
  };
}

export function formatUmlInterfaceText(sections: UmlInterfaceSections): string {
  return `${sections.interfaceName}\n---\n${sections.methods}`;
}

export function normalizeHtmlToText(html: string | undefined | null): string {
  if (!html) {
    return '';
  }
  return (
    html
      // An empty block line like <div><br></div> or <p><br></p> represents a single newline
      .replace(/<(?:div|p)[^>]*>\s*<br\s*\/?>\s*<\/(?:div|p)>/gi, '\n')
      // Any remaining <br> represents a newline
      .replace(/<br\s*\/?>/gi, '\n')
      // Start of block elements represent a newline
      .replace(/<(?:div|p|h[1-6])[^>]*>/gi, '\n')
      // Remove closing tags and any other HTML tags
      .replace(/<\/(?:div|p|h[1-6])>/gi, '')
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      // Remove at most one leading newline if the content began with a block tag like <div>
      .replace(/^\n/, '')
  );
}

function countLines(text: string | undefined | null, width?: number, fontSize = 13): number {
  if (!text) {
    return 1;
  }
  const normalized = normalizeHtmlToText(text);
  if (!normalized) {
    return 1;
  }
  const lines = normalized.split(/\r?\n/);
  if (!width || width <= 0) {
    return Math.max(1, lines.length);
  }
  const availWidth = Math.max(40, width - 24);
  const avgCharWidth = fontSize * 0.58;
  const charsPerLine = Math.max(1, Math.floor(availWidth / avgCharWidth));

  let totalVisualLines = 0;
  for (const line of lines) {
    const visualLines = line.length === 0 ? 1 : Math.max(1, Math.ceil(line.length / charsPerLine));
    totalVisualLines += visualLines;
  }
  return Math.max(1, totalVisualLines);
}

export function computeUmlClassRequiredHeight(
  sections: UmlClassSections,
  fontSize = 13,
  width?: number,
): number {
  const lineH = Math.max(18, Math.round(fontSize * 1.4));
  const classLines = countLines(sections.className, width, fontSize);
  const attrLines = countLines(sections.attributes, width, fontSize);
  const methodLines = countLines(sections.methods, width, fontSize);

  const headerH = Math.max(32, classLines * lineH + 14);
  const attrH = Math.max(26, attrLines * lineH + 12);
  const methodH = Math.max(26, methodLines * lineH + 12);

  return headerH + attrH + methodH;
}

export function computeUmlInterfaceRequiredHeight(
  sections: UmlInterfaceSections,
  fontSize = 13,
  width?: number,
): number {
  const lineH = Math.max(18, Math.round(fontSize * 1.4));
  const ifaceLines = countLines(sections.interfaceName, width, fontSize);
  const methodLines = countLines(sections.methods, width, fontSize);

  const headerH = Math.max(34, ifaceLines * lineH + 14);
  const methodH = Math.max(26, methodLines * lineH + 12);

  return headerH + methodH;
}
