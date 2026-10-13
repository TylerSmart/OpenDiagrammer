import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { FullscreenService } from '../../../core/services/fullscreen/fullscreen.service';
import {
  CANVAS_CONSTANTS,
  CanvasClipboardData,
  CanvasDiagramData,
  CanvasPoint,
  CanvasTransform,
} from './canvas.models';
import {
  AnchorPosition,
  CanvasConnection,
  ConnectionMarker,
  ConnectionPattern,
  ConnectionRouting,
  ConnectionSegment,
  RenderedConnection,
  computeConnectionPath,
  extractConnectionSegments,
  getShapeAnchorPoint,
} from './connection.models';
import {
  ActiveTool,
  AlignmentGuide,
  BoundingBox,
  CanvasColorPreset,
  CanvasShape,
  CANVAS_COLOR_PRESETS,
  ResizeHandlePosition,
  SHAPE_CONSTANTS,
  ShapeType,
  computeShapeMovementSnapping,
  computeShapeResizeSnapping,
} from './shape.models';
import { CanvasShapeComponent } from './shape/canvas-shape.component';

export interface ReconnectingPreview {
  connId: string;
  endpoint: 'source' | 'target';
  startPoint: CanvasPoint;
  endPoint: CanvasPoint;
  currentPoint: CanvasPoint;
  path: string;
  startMarker?: boolean;
  endMarker?: boolean;
  targetShapeId?: string;
  targetAnchor?: AnchorPosition;
  sourceShapeId?: string;
  sourceAnchor?: AnchorPosition;
}

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    CanvasShapeComponent,
  ],
  selector: 'app-canvas',
  styleUrl: './canvas.component.scss',
  templateUrl: './canvas.component.html',
  host: {
    tabindex: '0',
    '(keydown)': 'handleKeyDown($event)',
    '(keyup)': 'handleKeyUp($event)',
    '(wheel)': 'handleWheel($event)',
    '(pointerdown)': 'handlePointerDown($event)',
    '(pointermove)': 'handlePointerMove($event)',
    '(pointerup)': 'handlePointerUp($event)',
    '(pointercancel)': 'handlePointerUp($event)',
    '(contextmenu)': 'handleContextMenu($event)',
    '(blur)': 'handleBlur()',
  },
})
export class CanvasComponent {
  // Inputs for board settings and canvas persistence
  readonly backgroundType = input<BoardBackgroundType>(BoardBackgroundType.GridLines);
  readonly initialCanvasData = input<string | null>(null);
  readonly readOnly = input<boolean>(false);

  // Transform and diagram change output events
  readonly transformChange = output<CanvasTransform>();
  readonly diagramChange = output<CanvasDiagramData>();

  // Internal reactive transform state
  readonly zoom = signal<number>(CANVAS_CONSTANTS.DEFAULT_ZOOM);
  readonly panX = signal<number>(0);
  readonly panY = signal<number>(0);

  // Shapes & Diagramming State
  readonly shapes = signal<CanvasShape[]>([]);
  readonly selectedShapeIds = signal<Set<string>>(new Set<string>());
  readonly activeTool = signal<ActiveTool>('select');

  // Connections State
  readonly connections = signal<CanvasConnection[]>([]);
  readonly selectedConnectionIds = signal<Set<string>>(new Set<string>());
  readonly inProgressConnection = signal<{
    sourceShapeId: string;
    sourceAnchor: AnchorPosition;
    currentPoint: CanvasPoint;
    targetShapeId?: string;
    targetAnchor?: AnchorPosition;
    path: string;
  } | null>(null);

  readonly hoveredConnectionId = signal<string | null>(null);

  private hoveredAnchor: { shape: CanvasShape; anchor: AnchorPosition } | null = null;

  // Marquee selection state
  readonly marqueeBox = signal<BoundingBox | null>(null);
  private marqueeStart: CanvasPoint | null = null;

  // Alignment & Snapping state
  readonly alignmentGuides = signal<AlignmentGuide[]>([]);
  private initialMovingBounds: BoundingBox | null = null;

  // Node movement state
  private isMovingShapes = false;
  private moveStartPoint: CanvasPoint | null = null;
  private shapeInitialPositions = new Map<string, CanvasPoint>();
  private connectionInitialWaypoints = new Map<string, CanvasPoint[]>();
  private isAltDragPending = false;
  private hasClonedForAltDrag = false;

  // Resize state
  private isResizing = false;
  private activeResizeHandle: ResizeHandlePosition | null = null;
  private resizeStartPoint: CanvasPoint | null = null;
  private resizeInitialShape: CanvasShape | null = null;

  readonly resizeHandles: ResizeHandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  // Selection Bounding Box computation
  readonly selectionBox = computed<BoundingBox | null>(() => {
    const selectedIds = this.selectedShapeIds();
    if (selectedIds.size === 0) {
      return null;
    }

    const selectedShapes = this.shapes().filter((s) => selectedIds.has(s.id));
    if (selectedShapes.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const s of selectedShapes) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  });

  // Contextual Selection Toolbar position
  readonly selectionToolbarPos = computed<{ x: number; y: number } | null>(() => {
    const box = this.selectionBox();
    if (!box || this.selectedShapeIds().size === 0) {
      return null;
    }
    return {
      x: box.minX + box.width / 2,
      y: box.minY - 14,
    };
  });

  readonly currentSelectedShapeStrokeColor = computed<string>(() => {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return 'var(--canvas-color-default-stroke)';
    }
    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    if (selectedShapes.length === 0) {
      return 'var(--canvas-color-default-stroke)';
    }
    return selectedShapes[0].strokeColor;
  });

  readonly currentSelectedShapeFillColor = computed<string>(() => {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return 'var(--canvas-color-default-fill)';
    }
    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    if (selectedShapes.length === 0) {
      return 'var(--canvas-color-default-fill)';
    }
    return selectedShapes[0].fillColor;
  });

  readonly hasSelectedGroup = computed<boolean>(() => {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return false;
    }
    return this.shapes().some((s) => selected.has(s.id) && s.groupId !== undefined);
  });

  // Rendered Connections computation
  readonly renderedConnections = computed<RenderedConnection[]>(() => {
    const shapeMap = new Map(this.shapes().map((s) => [s.id, s]));
    const result: RenderedConnection[] = [];

    for (const conn of this.connections()) {
      const sourceShape = shapeMap.get(conn.sourceShapeId);
      if (!sourceShape) {
        continue;
      }

      const start = getShapeAnchorPoint(sourceShape, conn.sourceAnchor);
      let end: CanvasPoint;

      if (conn.targetShapeId && shapeMap.has(conn.targetShapeId) && conn.targetAnchor) {
        const targetShape = shapeMap.get(conn.targetShapeId)!;
        end = getShapeAnchorPoint(targetShape, conn.targetAnchor);
      } else if (conn.targetPoint) {
        end = conn.targetPoint;
      } else {
        continue;
      }

      const isSelfLoop =
        conn.targetShapeId === conn.sourceShapeId &&
        conn.targetAnchor !== undefined &&
        conn.sourceAnchor !== conn.targetAnchor;

      const shapeBounds =
        isSelfLoop && sourceShape
          ? {
              x: sourceShape.x,
              y: sourceShape.y,
              width: sourceShape.width,
              height: sourceShape.height,
            }
          : undefined;

      const { path, midpoint, points } = computeConnectionPath(
        start,
        end,
        conn.routing,
        conn.sourceAnchor,
        conn.targetAnchor,
        conn.waypoints,
        shapeBounds,
        isSelfLoop,
      );

      let dashArray: string | undefined;
      if (conn.pattern === 'dashed') {
        dashArray = '6,4';
      } else if (conn.pattern === 'dotted') {
        dashArray = '2,3';
      }

      const segments = extractConnectionSegments(points, 30);

      result.push({
        id: conn.id,
        path,
        strokeColor: conn.strokeColor,
        strokeWidth: conn.strokeWidth,
        pattern: conn.pattern,
        routing: conn.routing,
        dashArray,
        startMarker: conn.startMarker,
        endMarker: conn.endMarker,
        startPoint: start,
        endPoint: end,
        midpoint,
        text: conn.text,
        waypoints: conn.waypoints || [],
        points,
        segments,
      });
    }

    return result;
  });

  // Single selected connection for contextual toolbar & waypoint handles
  readonly singleSelectedConnection = computed<RenderedConnection | null>(() => {
    const selectedIds = this.selectedConnectionIds();
    if (selectedIds.size !== 1) {
      return null;
    }
    const id = Array.from(selectedIds)[0];
    return this.renderedConnections().find((c) => c.id === id) || null;
  });

  readonly hasSelectedConnection = computed<boolean>(() => this.selectedConnectionIds().size > 0);

  // Connection Waypoint Dragging State
  private isDraggingWaypoint = false;
  private activeWaypointConnId: string | null = null;
  private activeWaypointIndex: number | null = null;
  private isNewWaypoint = false;

  // Orthogonal Segment Dragging State
  private isDraggingSegment = false;
  private activeSegmentConnId: string | null = null;
  private activeSegmentIndex: number | null = null;
  private activeSegmentOrientation: 'horizontal' | 'vertical' | null = null;
  private segmentDragInitialPoints: CanvasPoint[] = [];

  // Connection Endpoint Reconnecting State
  readonly draggingEndpoint = signal<{
    connId: string;
    endpoint: 'source' | 'target';
  } | null>(null);

  readonly reconnectingPreview = signal<ReconnectingPreview | null>(null);
  private initialReconnectingConn: CanvasConnection | null = null;

  // Inline connection text editing state
  readonly editingConnectionId = signal<string | null>(null);

  readonly canvasColorPresets = CANVAS_COLOR_PRESETS;
  readonly connectionColors = CANVAS_COLOR_PRESETS.map((p) => p.stroke);

  readonly connectionToolbarPos = computed<{
    x: number;
    y: number;
    placement: 'top' | 'bottom';
  } | null>(() => {
    const conn = this.singleSelectedConnection();
    if (!conn) {
      return null;
    }

    const DOCK_WIDTH = 340;
    const DOCK_HEIGHT = 44;
    const HALF_W = DOCK_WIDTH / 2;

    // Collect obstacles to avoid: shapes, endpoint handles, segment handles, waypoints, and connector polyline
    interface Rect {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }

    const obstacles: Rect[] = [];

    // 1. All shapes on board
    for (const s of this.shapes()) {
      obstacles.push({
        minX: s.x - 8,
        maxX: s.x + s.width + 8,
        minY: s.y - 8,
        maxY: s.y + s.height + 8,
      });
    }

    // 2. Connector endpoints (reconnect handles)
    obstacles.push({
      minX: conn.startPoint.x - 14,
      maxX: conn.startPoint.x + 14,
      minY: conn.startPoint.y - 14,
      maxY: conn.startPoint.y + 14,
    });
    obstacles.push({
      minX: conn.endPoint.x - 14,
      maxX: conn.endPoint.x + 14,
      minY: conn.endPoint.y - 14,
      maxY: conn.endPoint.y + 14,
    });

    // 3. Reshaping handles (segment handles or waypoints)
    if (conn.routing === 'orthogonal' && conn.segments) {
      for (const seg of conn.segments) {
        obstacles.push({
          minX: seg.midpoint.x - 16,
          maxX: seg.midpoint.x + 16,
          minY: seg.midpoint.y - 16,
          maxY: seg.midpoint.y + 16,
        });
      }
    } else {
      if (conn.waypoints) {
        for (const wp of conn.waypoints) {
          obstacles.push({
            minX: wp.x - 14,
            maxX: wp.x + 14,
            minY: wp.y - 14,
            maxY: wp.y + 14,
          });
        }
      }
    }

    // 4. Connector polyline bounding box / points (to avoid sitting right on the connector line itself)
    const pts =
      conn.points && conn.points.length > 0 ? conn.points : [conn.startPoint, conn.endPoint];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      obstacles.push({
        minX: Math.min(p1.x, p2.x) - 4,
        maxX: Math.max(p1.x, p2.x) + 4,
        minY: Math.min(p1.y, p2.y) - 4,
        maxY: Math.max(p1.y, p2.y) + 4,
      });
    }

    // Helper: test if dock rect [cx - HALF_W, cx + HALF_W] x [dockMinY, dockMaxY] intersects any obstacle
    function overlaps(cx: number, dockMinY: number, dockMaxY: number): boolean {
      const dMinX = cx - HALF_W;
      const dMaxX = cx + HALF_W;
      for (const obs of obstacles) {
        const xOverlap = dMinX < obs.maxX && dMaxX > obs.minX;
        const yOverlap = dockMinY < obs.maxY && dockMaxY > obs.minY;
        if (xOverlap && yOverlap) {
          return true;
        }
      }
      return false;
    }

    // Helper: calculate total overlap area / penalty if no completely clear slot is found
    function getOverlapPenalty(cx: number, dockMinY: number, dockMaxY: number): number {
      const dMinX = cx - HALF_W;
      const dMaxX = cx + HALF_W;
      let penalty = 0;
      for (const obs of obstacles) {
        const xOverlap = Math.max(0, Math.min(dMaxX, obs.maxX) - Math.max(dMinX, obs.minX));
        const yOverlap = Math.max(0, Math.min(dockMaxY, obs.maxY) - Math.max(dockMinY, obs.minY));
        if (xOverlap > 0 && yOverlap > 0) {
          penalty += xOverlap * yOverlap;
        }
      }
      return penalty;
    }

    const mid = conn.midpoint;

    // Check Candidate Placements:
    // Placements can try 'top' (dock sits above pos.y - 12) or 'bottom' (dock sits below pos.y + 12)
    // Candidate distances: default (12px margin), expanded clearances (35px, 60px, 90px, 120px)
    const offsets = [12, 35, 60, 90, 130];
    const candidatePlacements: {
      placement: 'top' | 'bottom';
      offset: number;
      x: number;
      y: number;
      dockMinY: number;
      dockMaxY: number;
    }[] = [];

    // Try both placements with increasing clearance
    for (const offset of offsets) {
      // Top candidate
      const topDockMaxY = mid.y - offset;
      const topDockMinY = topDockMaxY - DOCK_HEIGHT;
      candidatePlacements.push({
        placement: 'top',
        offset,
        x: mid.x,
        y: mid.y - (offset - 12),
        dockMinY: topDockMinY,
        dockMaxY: topDockMaxY,
      });

      // Bottom candidate
      const btmDockMinY = mid.y + offset;
      const btmDockMaxY = btmDockMinY + DOCK_HEIGHT;
      candidatePlacements.push({
        placement: 'bottom',
        offset,
        x: mid.x,
        y: mid.y + (offset - 12),
        dockMinY: btmDockMinY,
        dockMaxY: btmDockMaxY,
      });
    }

    // Prefer candidate with 0 overlap (closest to midpoint first)
    for (const cand of candidatePlacements) {
      if (!overlaps(cand.x, cand.dockMinY, cand.dockMaxY)) {
        return {
          x: cand.x,
          y: cand.y,
          placement: cand.placement,
        };
      }
    }

    // If perfectly clear slot is not found at exact mid.x, test slight horizontal shifts (±60px, ±120px)
    const xShifts = [-60, 60, -120, 120];
    for (const dx of xShifts) {
      for (const cand of candidatePlacements) {
        if (!overlaps(cand.x + dx, cand.dockMinY, cand.dockMaxY)) {
          return {
            x: cand.x + dx,
            y: cand.y,
            placement: cand.placement,
          };
        }
      }
    }

    // Fallback: pick the candidate that minimizes total obstacle overlap penalty
    let bestCand = candidatePlacements[0];
    let minPenalty = Number.MAX_VALUE;
    for (const cand of candidatePlacements) {
      const p = getOverlapPenalty(cand.x, cand.dockMinY, cand.dockMaxY);
      if (p < minPenalty) {
        minPenalty = p;
        bestCand = cand;
      }
    }

    return {
      x: bestCand.x,
      y: bestCand.y,
      placement: bestCand.placement,
    };
  });

  updateConnection(id: string, partial: Partial<CanvasConnection>): void {
    this.connections.update((list) =>
      list.map((c) => {
        if (c.id !== id) return c;
        const candidate = { ...c, ...partial };
        if (
          candidate.targetShapeId &&
          candidate.sourceShapeId === candidate.targetShapeId &&
          candidate.sourceAnchor === candidate.targetAnchor
        ) {
          return c;
        }
        return candidate;
      }),
    );
  }

  setConnectionRouting(routing: ConnectionRouting): void {
    const conn = this.singleSelectedConnection();
    if (conn) {
      this.updateConnection(conn.id, { routing, waypoints: [] });
    }
  }

  setConnectionPattern(pattern: ConnectionPattern): void {
    const conn = this.singleSelectedConnection();
    if (conn) {
      this.updateConnection(conn.id, { pattern });
    }
  }

  setConnectionMarkers(mode: 'none' | 'end' | 'start' | 'both'): void {
    const conn = this.singleSelectedConnection();
    if (!conn) {
      return;
    }
    let startMarker: ConnectionMarker = 'none';
    let endMarker: ConnectionMarker = 'none';

    if (mode === 'end') {
      endMarker = 'arrow';
    } else if (mode === 'start') {
      startMarker = 'arrow';
    } else if (mode === 'both') {
      startMarker = 'arrow';
      endMarker = 'arrow';
    }

    this.updateConnection(conn.id, { startMarker, endMarker });
  }

  setConnectionColor(color: string): void {
    const conn = this.singleSelectedConnection();
    if (conn) {
      this.updateConnection(conn.id, { strokeColor: color });
    }
  }

  setConnectionWidth(width: number): void {
    const conn = this.singleSelectedConnection();
    if (conn) {
      this.updateConnection(conn.id, { strokeWidth: width });
    }
  }

  startEditingConnectionText(connId: string): void {
    this.selectConnection(connId);
    this.editingConnectionId.set(connId);
    queueMicrotask(() => {
      const inputEl = this.connTextInput()?.nativeElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    });
  }

  finishEditingConnectionText(connId: string, text: string): void {
    this.updateConnection(connId, { text: text.trim() || undefined });
    this.editingConnectionId.set(null);
  }

  getConnectionFillColor(strokeColor: string): string {
    const preset = this.canvasColorPresets.find((p) => p.stroke === strokeColor);
    return preset ? preset.fill : 'var(--mat-sys-surface)';
  }

  getConnectionTextColor(strokeColor: string): string {
    if (strokeColor.includes('inverse')) {
      return 'var(--canvas-color-inverse-text)';
    }
    return strokeColor;
  }

  resetConnectionWaypoints(connId: string): void {
    this.updateConnection(connId, { waypoints: [] });
    this.selectConnection(connId);
  }

  handleSegmentDblClick(event: MouseEvent, connId: string): void {
    event.stopPropagation();
    this.resetConnectionWaypoints(connId);
  }

  // Interaction tracking state
  readonly isPanning = signal<boolean>(false);
  isSpacePressed = false;
  private hasDraggedDuringPan = false;
  private preventContextMenuUntil = 0;
  private lastPointerPos: CanvasPoint | null = null;
  private activePointers = new Map<number, CanvasPoint>();
  private initialPinchDistance: number | null = null;
  private initialPinchZoom = 1.0;

  // View child references
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly fullscreenService = inject(FullscreenService);
  readonly connTextInput = viewChild<ElementRef<HTMLInputElement>>('textInput');

  // Persistence state tracking
  private lastLoadedDataJson: string | null = null;
  private lastEmittedJson: string | null = null;
  private hasLoadedInitialData = false;

  constructor() {
    effect(() => {
      const editId = this.editingConnectionId();
      const inputRef = this.connTextInput();
      if (editId && inputRef) {
        inputRef.nativeElement.focus();
        inputRef.nativeElement.select();
      }
    });

    effect(() => {
      const dataJson = this.initialCanvasData();
      untracked(() => {
        if (dataJson !== this.lastLoadedDataJson) {
          this.loadCanvasData(dataJson);
        }
      });
    });

    effect(() => {
      const shapes = this.shapes();
      const connections = this.connections();
      if (!this.hasLoadedInitialData || this.readOnly()) {
        return;
      }
      untracked(() => {
        const currentJson = JSON.stringify({ shapes, connections });
        if (currentJson === this.lastEmittedJson) {
          return;
        }
        this.lastEmittedJson = currentJson;
        this.diagramChange.emit({
          shapes,
          connections,
          zoom: this.zoom(),
          panX: this.panX(),
          panY: this.panY(),
        });
      });
    });
  }

  loadCanvasData(dataJson: string | null): void {
    this.lastLoadedDataJson = dataJson;
    if (!dataJson) {
      this.shapes.set([]);
      this.connections.set([]);
      this.lastEmittedJson = JSON.stringify({ shapes: [], connections: [] });
      this.hasLoadedInitialData = true;
      return;
    }

    try {
      const parsed: CanvasDiagramData = JSON.parse(dataJson);
      const shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
      const connections = Array.isArray(parsed.connections) ? parsed.connections : [];
      this.shapes.set(shapes);
      this.connections.set(connections);
      if (typeof parsed.zoom === 'number' && parsed.zoom > 0) {
        this.zoom.set(parsed.zoom);
      }
      if (typeof parsed.panX === 'number') {
        this.panX.set(parsed.panX);
      }
      if (typeof parsed.panY === 'number') {
        this.panY.set(parsed.panY);
      }
      this.lastEmittedJson = JSON.stringify({ shapes, connections });
      this.hasLoadedInitialData = true;
    } catch {
      this.shapes.set([]);
      this.connections.set([]);
      this.lastEmittedJson = JSON.stringify({ shapes: [], connections: [] });
      this.hasLoadedInitialData = true;
    }
  }

  // Computed zoom percentage formatted string
  readonly zoomPercentage = computed(() => `${Math.round(this.zoom() * 100)}%`);

  // Computed CSS transform matrix for canvas content layer
  readonly contentTransform = computed(() => {
    return `matrix(${this.zoom()}, 0, 0, ${this.zoom()}, ${this.panX()}, ${this.panY()})`;
  });

  // Background styling computed with dynamic adaptive grid step based on zoom level
  readonly backgroundStyles = computed(() => {
    const scale = this.zoom();
    const bgType = this.backgroundType();
    const panX = this.panX();
    const panY = this.panY();

    let bgSize = '';
    if (bgType === BoardBackgroundType.GridLines || bgType === BoardBackgroundType.GridDots) {
      const baseSize =
        bgType === BoardBackgroundType.GridLines
          ? CANVAS_CONSTANTS.GRID_SIZE
          : CANVAS_CONSTANTS.DOT_GRID_SIZE;

      let multiplier = 1;
      while (baseSize * scale * multiplier < 18) {
        multiplier *= 2;
      }
      while (baseSize * scale * multiplier > 72) {
        multiplier /= 2;
      }

      const size = baseSize * scale * multiplier;
      bgSize = `${size}px ${size}px`;
    }

    return {
      backgroundPosition: `${panX}px ${panY}px`,
      ...(bgSize ? { backgroundSize: bgSize } : {}),
    };
  });

  readonly isGridLines = computed(() => this.backgroundType() === BoardBackgroundType.GridLines);
  readonly isGridDots = computed(() => this.backgroundType() === BoardBackgroundType.GridDots);

  // Coordinate conversion helper methods
  screenToWorld(screenPoint: CanvasPoint): CanvasPoint {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const relativeX = screenPoint.x - rect.left;
    const relativeY = screenPoint.y - rect.top;
    return {
      x: (relativeX - this.panX()) / this.zoom(),
      y: (relativeY - this.panY()) / this.zoom(),
    };
  }

  worldToScreen(worldPoint: CanvasPoint): CanvasPoint {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    return {
      x: worldPoint.x * this.zoom() + this.panX() + rect.left,
      y: worldPoint.y * this.zoom() + this.panY() + rect.top,
    };
  }

  // Zoom actions
  zoomIn(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const focal = { x: rect.width / 2, y: rect.height / 2 };
    this.zoomTo(this.zoom() * 1.25, focal);
  }

  zoomOut(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const focal = { x: rect.width / 2, y: rect.height / 2 };
    this.zoomTo(this.zoom() / 1.25, focal);
  }

  resetZoom(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const focal = { x: rect.width / 2, y: rect.height / 2 };
    this.zoomTo(CANVAS_CONSTANTS.DEFAULT_ZOOM, focal);
  }

  resetView(): void {
    this.zoom.set(CANVAS_CONSTANTS.DEFAULT_ZOOM);
    this.panX.set(0);
    this.panY.set(0);
    this.emitTransformChange();
  }

  zoomTo(targetZoom: number, focalPoint?: CanvasPoint): void {
    const clampedZoom = Math.min(
      CANVAS_CONSTANTS.MAX_ZOOM,
      Math.max(CANVAS_CONSTANTS.MIN_ZOOM, targetZoom),
    );

    const currentZoom = this.zoom();
    if (Math.abs(clampedZoom - currentZoom) < 0.0001) {
      return;
    }

    const focal = focalPoint ?? {
      x: this.elementRef.nativeElement.clientWidth / 2,
      y: this.elementRef.nativeElement.clientHeight / 2,
    };

    const worldX = (focal.x - this.panX()) / currentZoom;
    const worldY = (focal.y - this.panY()) / currentZoom;

    const newPanX = focal.x - worldX * clampedZoom;
    const newPanY = focal.y - worldY * clampedZoom;

    this.zoom.set(clampedZoom);
    this.panX.set(newPanX);
    this.panY.set(newPanY);
    this.emitTransformChange();
  }

  panBy(deltaX: number, deltaY: number): void {
    this.panX.update((x) => x + deltaX);
    this.panY.update((y) => y + deltaY);
    this.emitTransformChange();
  }

  // Event handlers
  handleContextMenu(event: MouseEvent): void {
    if (this.isPanning() || Date.now() < this.preventContextMenuUntil) {
      event.preventDefault();
    }
  }

  private lastTrackpadGestureTime = 0;

  isTrackpadWheel(event: WheelEvent): boolean {
    // 1. Line or Page deltaMode is exclusively emitted by physical mice (e.g. Firefox line scrolling).
    if (event.deltaMode !== 0) {
      return false;
    }

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);

    // 2. Fractional deltas are a telltale signature of precision trackpad scrolling.
    const isFractional = absX % 1 !== 0 || absY % 1 !== 0;
    if (isFractional) {
      this.lastTrackpadGestureTime = Date.now();
      return true;
    }

    // 3. Simultaneous horizontal and vertical scrolling (2D diagonal swipe) is characteristic of trackpads.
    if (absX > 0 && absY > 0) {
      this.lastTrackpadGestureTime = Date.now();
      return true;
    }

    // 4. Very small deltas (< 20px) at the start or end of a continuous swipe indicate trackpads.
    // (Physical mouse wheels emit discrete notches: typically >= 40px, standard 100px or 120px).
    if ((absY > 0 && absY < 20) || (absX > 0 && absX < 20)) {
      this.lastTrackpadGestureTime = Date.now();
      return true;
    }

    // 5. Inertial momentum / ongoing gesture: if trackpad was detected within the last 350ms,
    // continue treating deceleration events as trackpad scrolling.
    if (Date.now() - this.lastTrackpadGestureTime < 350) {
      this.lastTrackpadGestureTime = Date.now();
      return true;
    }

    // 6. If deltaX is 0 and deltaY is a discrete large integer (>= 20px, e.g. 50, 100, 120), it's a mouse wheel.
    if (absX === 0 && absY >= 20) {
      return false;
    }

    // 7. If deltaY is 0 and deltaX is horizontal scroll (e.g. mouse thumb wheel), treat as pan.
    if (absY === 0 && absX > 0) {
      return true;
    }

    return false;
  }

  handleWheel(event: WheelEvent): void {
    event.preventDefault();

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const focalPoint: CanvasPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    if (event.ctrlKey || event.metaKey) {
      const zoomFactor = Math.exp(-event.deltaY * 0.005);
      this.zoomTo(this.zoom() * zoomFactor, focalPoint);
      return;
    }

    if (event.shiftKey) {
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      this.panBy(-delta, 0);
      return;
    }

    if (this.isTrackpadWheel(event)) {
      this.panBy(-event.deltaX, -event.deltaY);
    } else {
      // Physical mouse wheel: zoom centered at mouse cursor position
      const zoomFactor = event.deltaY > 0 ? 1 / 1.15 : 1.15;
      this.zoomTo(this.zoom() * zoomFactor, focalPoint);
    }
  }

  // Shape Management & Selection API
  isShapeSelected(id: string): boolean {
    return this.selectedShapeIds().has(id);
  }

  setActiveTool(tool: ActiveTool): void {
    if (this.readOnly() && tool !== 'select') {
      return;
    }
    if (this.inProgressConnection()) {
      this.inProgressConnection.set(null);
      this.connectionStartScreenPos = null;
    }
    this.activeTool.set(tool);
  }

  clearSelection(): void {
    this.selectedShapeIds.set(new Set<string>());
    this.selectedConnectionIds.set(new Set<string>());
  }

  selectShape(id: string, multiSelect = false): void {
    const current = new Set(this.selectedShapeIds());
    const targetShape = this.shapes().find((s) => s.id === id);
    const idsToSelect =
      targetShape && targetShape.groupId
        ? this.shapes()
            .filter((s) => s.groupId === targetShape.groupId)
            .map((s) => s.id)
        : [id];

    if (multiSelect) {
      const allSelected = idsToSelect.every((item) => current.has(item));
      if (allSelected) {
        idsToSelect.forEach((item) => current.delete(item));
      } else {
        idsToSelect.forEach((item) => current.add(item));
      }
    } else {
      current.clear();
      idsToSelect.forEach((item) => current.add(item));
      this.selectedConnectionIds.set(new Set<string>());
    }
    this.selectedShapeIds.set(current);
  }

  createShape(type: ShapeType, worldPoint: CanvasPoint): CanvasShape {
    const newShape: CanvasShape = {
      id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      x: Math.round(worldPoint.x - SHAPE_CONSTANTS.DEFAULT_WIDTH / 2),
      y: Math.round(worldPoint.y - SHAPE_CONSTANTS.DEFAULT_HEIGHT / 2),
      width: SHAPE_CONSTANTS.DEFAULT_WIDTH,
      height: SHAPE_CONSTANTS.DEFAULT_HEIGHT,
      fillColor: SHAPE_CONSTANTS.DEFAULT_FILL,
      strokeColor: SHAPE_CONSTANTS.DEFAULT_STROKE,
      strokeWidth: SHAPE_CONSTANTS.DEFAULT_STROKE_WIDTH,
      zIndex: this.shapes().length + 1,
    };

    this.shapes.update((list) => [...list, newShape]);
    this.selectShape(newShape.id);
    return newShape;
  }

  updateShape(id: string, partial: Partial<CanvasShape>): void {
    this.shapes.update((list) => list.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }

  setSelectedShapesColor(preset: CanvasColorPreset): void {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return;
    }
    this.shapes.update((list) =>
      list.map((s) =>
        selected.has(s.id)
          ? {
              ...s,
              fillColor: preset.fill,
              strokeColor: preset.stroke,
            }
          : s,
      ),
    );
  }

  isShapeColorActive(preset: CanvasColorPreset): boolean {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return false;
    }
    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    return (
      selectedShapes.length > 0 && selectedShapes.every((s) => s.strokeColor === preset.stroke)
    );
  }

  deleteSelectedShapes(): void {
    const selected = this.selectedShapeIds();
    const selectedConns = this.selectedConnectionIds();

    if (selected.size > 0) {
      this.shapes.update((list) => list.filter((s) => !selected.has(s.id)));
      // Also remove any connections linked to deleted shapes
      this.connections.update((conns) =>
        conns.filter((c) => !selected.has(c.sourceShapeId) && !selected.has(c.targetShapeId ?? '')),
      );
    }

    if (selectedConns.size > 0) {
      this.connections.update((conns) => conns.filter((c) => !selectedConns.has(c.id)));
    }

    this.clearSelection();
  }

  // Layer Management (Z-Index / Stacking Order)
  bringToFront(shapeIds?: string[]): void {
    const targetIds = new Set(shapeIds ?? this.selectedShapeIds());
    if (targetIds.size === 0) {
      return;
    }
    const all = [...this.shapes()].sort((a, b) => a.zIndex - b.zIndex);
    const nonSelected = all.filter((s) => !targetIds.has(s.id));
    const selected = all.filter((s) => targetIds.has(s.id));
    const reordered = [...nonSelected, ...selected];
    const newZIndexMap = new Map<string, number>();
    reordered.forEach((s, idx) => newZIndexMap.set(s.id, idx + 1));
    this.shapes.update((list) =>
      list.map((s) => ({ ...s, zIndex: newZIndexMap.get(s.id) ?? s.zIndex })),
    );
  }

  sendToBack(shapeIds?: string[]): void {
    const targetIds = new Set(shapeIds ?? this.selectedShapeIds());
    if (targetIds.size === 0) {
      return;
    }
    const all = [...this.shapes()].sort((a, b) => a.zIndex - b.zIndex);
    const nonSelected = all.filter((s) => !targetIds.has(s.id));
    const selected = all.filter((s) => targetIds.has(s.id));
    const reordered = [...selected, ...nonSelected];
    const newZIndexMap = new Map<string, number>();
    reordered.forEach((s, idx) => newZIndexMap.set(s.id, idx + 1));
    this.shapes.update((list) =>
      list.map((s) => ({ ...s, zIndex: newZIndexMap.get(s.id) ?? s.zIndex })),
    );
  }

  bringForward(shapeIds?: string[]): void {
    const targetIds = new Set(shapeIds ?? this.selectedShapeIds());
    if (targetIds.size === 0) {
      return;
    }
    const all = [...this.shapes()].sort((a, b) => a.zIndex - b.zIndex);
    for (let i = all.length - 2; i >= 0; i--) {
      if (targetIds.has(all[i].id) && !targetIds.has(all[i + 1].id)) {
        const temp = all[i];
        all[i] = all[i + 1];
        all[i + 1] = temp;
      }
    }
    const newZIndexMap = new Map<string, number>();
    all.forEach((s, idx) => newZIndexMap.set(s.id, idx + 1));
    this.shapes.update((list) =>
      list.map((s) => ({ ...s, zIndex: newZIndexMap.get(s.id) ?? s.zIndex })),
    );
  }

  sendBackward(shapeIds?: string[]): void {
    const targetIds = new Set(shapeIds ?? this.selectedShapeIds());
    if (targetIds.size === 0) {
      return;
    }
    const all = [...this.shapes()].sort((a, b) => a.zIndex - b.zIndex);
    for (let i = 1; i < all.length; i++) {
      if (targetIds.has(all[i].id) && !targetIds.has(all[i - 1].id)) {
        const temp = all[i];
        all[i] = all[i - 1];
        all[i - 1] = temp;
      }
    }
    const newZIndexMap = new Map<string, number>();
    all.forEach((s, idx) => newZIndexMap.set(s.id, idx + 1));
    this.shapes.update((list) =>
      list.map((s) => ({ ...s, zIndex: newZIndexMap.get(s.id) ?? s.zIndex })),
    );
  }

  // Grouping API
  groupSelectedShapes(): string | null {
    const selected = this.selectedShapeIds();
    if (selected.size < 2) {
      return null;
    }
    const newGroupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.shapes.update((list) =>
      list.map((s) => (selected.has(s.id) ? { ...s, groupId: newGroupId } : s)),
    );
    return newGroupId;
  }

  ungroupSelectedShapes(): void {
    const selected = this.selectedShapeIds();
    if (selected.size === 0) {
      return;
    }
    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    const targetGroupIds = new Set(selectedShapes.filter((s) => s.groupId).map((s) => s.groupId!));
    if (targetGroupIds.size === 0) {
      return;
    }
    this.shapes.update((list) =>
      list.map((s) =>
        s.groupId && targetGroupIds.has(s.groupId) ? { ...s, groupId: undefined } : s,
      ),
    );
  }

  // Copy, Cut, Paste, and Duplicate API (Within the Board)
  private clipboard: CanvasClipboardData | null = null;
  private pasteOffsetCount = 0;

  hasClipboard(): boolean {
    return (
      this.clipboard !== null &&
      (this.clipboard.shapes.length > 0 || this.clipboard.connections.length > 0)
    );
  }

  copy(): boolean {
    const selectedShapeIds = this.selectedShapeIds();
    const selectedConnIds = this.selectedConnectionIds();

    if (selectedShapeIds.size === 0 && selectedConnIds.size === 0) {
      return false;
    }

    const shapesToCopy = this.shapes().filter((s) => selectedShapeIds.has(s.id));

    // Include connections connecting between selected shapes, or explicitly selected connections
    const connsToCopy = this.connections().filter((c) => {
      if (selectedConnIds.has(c.id)) {
        return true;
      }
      if (
        c.targetShapeId &&
        selectedShapeIds.has(c.sourceShapeId) &&
        selectedShapeIds.has(c.targetShapeId)
      ) {
        return true;
      }
      return false;
    });

    this.clipboard = {
      shapes: shapesToCopy.map((s) => ({ ...s })),
      connections: connsToCopy.map((c) => ({
        ...c,
        waypoints: c.waypoints ? c.waypoints.map((p) => ({ ...p })) : undefined,
      })),
    };
    this.pasteOffsetCount = 0;
    return true;
  }

  cut(): boolean {
    const copied = this.copy();
    if (copied) {
      this.deleteSelectedShapes();
    }
    return copied;
  }

  duplicateShapesAndConnections(
    shapesToClone: CanvasShape[],
    connectionsToClone: CanvasConnection[],
    deltaX = 0,
    deltaY = 0,
  ): { newShapes: CanvasShape[]; newConnections: CanvasConnection[] } {
    const idMap = new Map<string, string>();
    const groupMap = new Map<string, string>();

    const maxZ = this.shapes().reduce((max, s) => Math.max(max, s.zIndex), 0);

    const newShapes: CanvasShape[] = shapesToClone.map((s, idx) => {
      const newId = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`;
      idMap.set(s.id, newId);

      let newGroupId: string | undefined;
      if (s.groupId) {
        if (!groupMap.has(s.groupId)) {
          groupMap.set(
            s.groupId,
            `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          );
        }
        newGroupId = groupMap.get(s.groupId);
      }

      return {
        ...s,
        id: newId,
        x: s.x + deltaX,
        y: s.y + deltaY,
        zIndex: maxZ + idx + 1,
        groupId: newGroupId,
      };
    });

    const newConnections: CanvasConnection[] = connectionsToClone.map((c, idx) => {
      const newId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`;
      const newSourceShapeId = idMap.get(c.sourceShapeId) ?? c.sourceShapeId;
      const newTargetShapeId = c.targetShapeId
        ? (idMap.get(c.targetShapeId) ?? c.targetShapeId)
        : undefined;
      const newTargetPoint = c.targetPoint
        ? { x: c.targetPoint.x + deltaX, y: c.targetPoint.y + deltaY }
        : undefined;
      const newWaypoints = c.waypoints
        ? c.waypoints.map((p) => ({ x: p.x + deltaX, y: p.y + deltaY }))
        : undefined;

      return {
        ...c,
        id: newId,
        sourceShapeId: newSourceShapeId,
        targetShapeId: newTargetShapeId,
        targetPoint: newTargetPoint,
        waypoints: newWaypoints,
      };
    });

    return { newShapes, newConnections };
  }

  paste(): boolean {
    if (
      !this.clipboard ||
      (this.clipboard.shapes.length === 0 && this.clipboard.connections.length === 0)
    ) {
      return false;
    }

    this.pasteOffsetCount++;
    const OFFSET_STEP = 24;
    const deltaX = OFFSET_STEP * this.pasteOffsetCount;
    const deltaY = OFFSET_STEP * this.pasteOffsetCount;

    const { newShapes, newConnections } = this.duplicateShapesAndConnections(
      this.clipboard.shapes,
      this.clipboard.connections,
      deltaX,
      deltaY,
    );

    this.shapes.update((list) => [...list, ...newShapes]);
    this.connections.update((list) => [...list, ...newConnections]);

    this.clearSelection();
    if (newShapes.length > 0) {
      this.selectedShapeIds.set(new Set(newShapes.map((s) => s.id)));
    } else if (newConnections.length > 0) {
      this.selectedConnectionIds.set(new Set(newConnections.map((c) => c.id)));
    }

    return true;
  }

  private performAltDragClone(): void {
    this.hasClonedForAltDrag = true;
    const selectedIds = this.selectedShapeIds();
    if (selectedIds.size === 0) {
      return;
    }

    const shapesToClone = this.shapes().filter((s) => selectedIds.has(s.id));
    if (shapesToClone.length === 0) {
      return;
    }

    const connsToClone = this.connections().filter(
      (c) =>
        c.targetShapeId && selectedIds.has(c.sourceShapeId) && selectedIds.has(c.targetShapeId),
    );

    const { newShapes, newConnections } = this.duplicateShapesAndConnections(
      shapesToClone,
      connsToClone,
      0,
      0,
    );

    this.shapes.update((list) => [...list, ...newShapes]);
    this.connections.update((list) => [...list, ...newConnections]);

    const newShapeIds = new Set(newShapes.map((s) => s.id));
    this.selectedShapeIds.set(newShapeIds);
    this.selectedConnectionIds.set(new Set());

    this.shapeInitialPositions.clear();
    for (const s of newShapes) {
      this.shapeInitialPositions.set(s.id, { x: s.x, y: s.y });
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of newShapes) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    }
    this.initialMovingBounds =
      isFinite(minX) && isFinite(minY)
        ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
        : null;

    this.connectionInitialWaypoints.clear();
    for (const c of newConnections) {
      const isSelfLoop =
        c.targetShapeId && c.sourceShapeId === c.targetShapeId && newShapeIds.has(c.sourceShapeId);
      const isBothEndpoints =
        c.targetShapeId && newShapeIds.has(c.sourceShapeId) && newShapeIds.has(c.targetShapeId);

      if ((isSelfLoop || isBothEndpoints) && c.waypoints?.length) {
        this.connectionInitialWaypoints.set(
          c.id,
          c.waypoints.map((p) => ({ ...p })),
        );
      }
    }
  }

  duplicate(): boolean {
    const copied = this.copy();
    if (!copied) {
      return false;
    }
    return this.paste();
  }

  // Connections API
  isConnectionSelected(id: string): boolean {
    return this.selectedConnectionIds().has(id);
  }

  selectConnection(id: string, multiSelect = false): void {
    const current = new Set(this.selectedConnectionIds());
    if (multiSelect) {
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
    } else {
      current.clear();
      current.add(id);
      this.selectedShapeIds.set(new Set<string>());
    }
    this.selectedConnectionIds.set(current);
  }

  createConnection(
    sourceShapeId: string,
    sourceAnchor: AnchorPosition,
    targetShapeId?: string,
    targetAnchor?: AnchorPosition,
    targetPoint?: CanvasPoint,
  ): CanvasConnection {
    if (targetShapeId && sourceShapeId === targetShapeId && sourceAnchor === targetAnchor) {
      throw new Error('A connector cannot loop on the same connector handle');
    }

    const newConn: CanvasConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceShapeId,
      sourceAnchor,
      targetShapeId,
      targetAnchor,
      targetPoint,
      routing: 'orthogonal',
      strokeColor: SHAPE_CONSTANTS.DEFAULT_STROKE,
      strokeWidth: 2,
      pattern: 'solid',
      endMarker: 'arrow',
    };

    this.connections.update((list) => [...list, newConn]);
    this.selectConnection(newConn.id);
    return newConn;
  }

  handleConnectionPointerDown(event: PointerEvent, connId: string): void {
    if (event.button !== 0 || this.isSpacePressed) {
      return;
    }
    event.stopPropagation();
    const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;
    this.selectConnection(connId, isMultiSelect);
  }

  handleEndpointPointerDown(
    event: PointerEvent,
    connId: string,
    endpoint: 'source' | 'target',
  ): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();

    const conn = this.connections().find((c) => c.id === connId);
    if (!conn) {
      return;
    }

    this.initialReconnectingConn = {
      ...conn,
      waypoints: conn.waypoints ? conn.waypoints.map((p) => ({ ...p })) : undefined,
    };
    this.draggingEndpoint.set({ connId, endpoint });

    const rendered = this.renderedConnections().find((c) => c.id === connId);
    if (rendered) {
      this.reconnectingPreview.set({
        connId,
        endpoint,
        startPoint: rendered.startPoint,
        endPoint: rendered.endPoint,
        currentPoint: endpoint === 'source' ? rendered.startPoint : rendered.endPoint,
        path: rendered.path,
        startMarker: conn.startMarker === 'arrow',
        endMarker: conn.endMarker === 'arrow',
        sourceShapeId: conn.sourceShapeId,
        sourceAnchor: conn.sourceAnchor,
        targetShapeId: conn.targetShapeId,
        targetAnchor: conn.targetAnchor,
      });
    }

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  private lastHandleClick: {
    handleKey: string;
    time: number;
    screenX: number;
    screenY: number;
  } | null = null;

  handleWaypointPointerDown(event: PointerEvent, connId: string, waypointIndex: number): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();

    const now = Date.now();
    const handleKey = `waypoint_${connId}_${waypointIndex}`;
    if (
      this.lastHandleClick &&
      this.lastHandleClick.handleKey === handleKey &&
      now - this.lastHandleClick.time < 350 &&
      Math.hypot(
        event.clientX - this.lastHandleClick.screenX,
        event.clientY - this.lastHandleClick.screenY,
      ) < 10
    ) {
      this.lastHandleClick = null;
      this.isDraggingWaypoint = false;
      this.activeWaypointConnId = null;
      this.activeWaypointIndex = null;
      this.handleWaypointDblClick(event, connId, waypointIndex);
      return;
    }

    this.lastHandleClick = {
      handleKey,
      time: now,
      screenX: event.clientX,
      screenY: event.clientY,
    };

    this.isDraggingWaypoint = true;
    this.activeWaypointConnId = connId;
    this.activeWaypointIndex = waypointIndex;
    this.isNewWaypoint = false;

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  handleMidpointPointerDown(event: PointerEvent, connId: string, segmentIndex: number): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const conn = this.connections().find((c) => c.id === connId);
    if (!conn) {
      return;
    }

    const worldPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
    const currentWaypoints = [...(conn.waypoints || [])];
    currentWaypoints.splice(segmentIndex, 0, worldPoint);

    this.updateConnection(connId, { waypoints: currentWaypoints });

    this.isDraggingWaypoint = true;
    this.activeWaypointConnId = connId;
    this.activeWaypointIndex = segmentIndex;
    this.isNewWaypoint = true;

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  handleSegmentPointerDown(event: PointerEvent, connId: string, segment: ConnectionSegment): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const rendered = this.renderedConnections().find((c) => c.id === connId);
    if (!rendered) {
      return;
    }

    const now = Date.now();
    const handleKey = `segment_${connId}_${segment.index}`;
    if (
      this.lastHandleClick &&
      this.lastHandleClick.handleKey === handleKey &&
      now - this.lastHandleClick.time < 350 &&
      Math.hypot(
        event.clientX - this.lastHandleClick.screenX,
        event.clientY - this.lastHandleClick.screenY,
      ) < 10
    ) {
      this.lastHandleClick = null;
      this.isDraggingSegment = false;
      this.activeSegmentConnId = null;
      this.activeSegmentIndex = null;
      this.activeSegmentOrientation = null;
      this.segmentDragInitialPoints = [];
      this.handleSegmentDblClick(event, connId);
      return;
    }

    this.lastHandleClick = {
      handleKey,
      time: now,
      screenX: event.clientX,
      screenY: event.clientY,
    };

    this.isDraggingSegment = true;
    this.activeSegmentConnId = connId;
    this.activeSegmentIndex = segment.index;
    this.activeSegmentOrientation = segment.orientation;
    this.segmentDragInitialPoints = rendered.points.map((p) => ({ ...p }));

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  handleWaypointDblClick(event: MouseEvent, connId: string, waypointIndex: number): void {
    event.stopPropagation();
    const conn = this.connections().find((c) => c.id === connId);
    if (!conn || !conn.waypoints) {
      return;
    }

    const updatedWaypoints = conn.waypoints.filter((_, idx) => idx !== waypointIndex);
    this.updateConnection(connId, { waypoints: updatedWaypoints });
  }

  private connectionStartScreenPos: CanvasPoint | null = null;

  handleAnchorPointerDown(payload: {
    event: PointerEvent;
    shape: CanvasShape;
    anchor: AnchorPosition;
  }): void {
    if (payload.event.button !== 0 || this.isSpacePressed) {
      return;
    }

    payload.event.stopPropagation();

    const inProg = this.inProgressConnection();

    // If a connection is already in progress (e.g. from a prior click), complete it now!
    if (inProg) {
      if (inProg.sourceShapeId !== payload.shape.id || inProg.sourceAnchor !== payload.anchor) {
        this.createConnection(
          inProg.sourceShapeId,
          inProg.sourceAnchor,
          payload.shape.id,
          payload.anchor,
        );
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
        return;
      } else {
        // Clicked exact same shape handle: cannot loop on the same connector handle
        return;
      }
    }

    this.selectedShapeIds.set(new Set());
    const startPoint = getShapeAnchorPoint(payload.shape, payload.anchor);
    const { path: initialPath } = computeConnectionPath(
      startPoint,
      startPoint,
      'orthogonal',
      payload.anchor,
    );

    this.connectionStartScreenPos = { x: payload.event.clientX, y: payload.event.clientY };
    this.inProgressConnection.set({
      sourceShapeId: payload.shape.id,
      sourceAnchor: payload.anchor,
      currentPoint: startPoint,
      path: initialPath,
    });

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(payload.event.pointerId);
    } catch {
      // Ignored
    }
  }

  handleAnchorHover(payload: { shape: CanvasShape; anchor: AnchorPosition } | null): void {
    this.hoveredAnchor = payload;
  }

  /**
   * Finds the nearest anchor point across shapes within snapping distance.
   * If sourceShapeId and sourceAnchor are provided, allows snapping to other anchors on the same shape
   * while excluding the exact same anchor (preventing loops on the same handle).
   */
  private findNearestAnchor(
    worldPoint: CanvasPoint,
    sourceShapeId: string,
    snapThreshold = 30,
    sourceAnchor?: AnchorPosition,
  ): { shape: CanvasShape; anchor: AnchorPosition; point: CanvasPoint } | null {
    const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
    let nearest: { shape: CanvasShape; anchor: AnchorPosition; point: CanvasPoint } | null = null;
    let minDistance = snapThreshold;

    for (const shape of this.shapes()) {
      for (const anchor of anchors) {
        if (shape.id === sourceShapeId) {
          if (!sourceAnchor || anchor === sourceAnchor) {
            continue;
          }
        }

        const pt = getShapeAnchorPoint(shape, anchor);
        const dist = Math.hypot(pt.x - worldPoint.x, pt.y - worldPoint.y);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = { shape, anchor, point: pt };
        }
      }
    }

    return nearest;
  }

  // Pointer event handlers on shapes
  handleShapePointerDown(event: PointerEvent, shape: CanvasShape): void {
    if (event.button !== 0 || this.isSpacePressed) {
      return;
    }

    event.stopPropagation();

    const inProg = this.inProgressConnection();

    if (inProg) {
      if (inProg.sourceShapeId !== shape.id) {
        const worldPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
        const nearest = this.findNearestAnchor(worldPoint, inProg.sourceShapeId, Infinity);
        const targetAnchor: AnchorPosition =
          nearest?.shape.id === shape.id ? nearest.anchor : 'left';

        this.createConnection(inProg.sourceShapeId, inProg.sourceAnchor, shape.id, targetAnchor);
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
        return;
      } else {
        // Clicked the same shape: select nearest anchor that is not the starting anchor
        const worldPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
        const eligibleAnchors = (['top', 'right', 'bottom', 'left'] as AnchorPosition[]).filter(
          (a) => a !== inProg.sourceAnchor,
        );
        let bestAnchor: AnchorPosition = eligibleAnchors[0];
        let bestDist = Infinity;
        for (const a of eligibleAnchors) {
          const pt = getShapeAnchorPoint(shape, a);
          const d = Math.hypot(pt.x - worldPoint.x, pt.y - worldPoint.y);
          if (d < bestDist) {
            bestDist = d;
            bestAnchor = a;
          }
        }
        this.createConnection(inProg.sourceShapeId, inProg.sourceAnchor, shape.id, bestAnchor);
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
        return;
      }
    }

    if (this.activeTool() === 'connection') {
      // Start connection from nearest anchor to where the user clicked on the shape
      const worldPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
      const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
      let bestAnchor: AnchorPosition = 'right';
      let bestDist = Infinity;
      for (const a of anchors) {
        const pt = getShapeAnchorPoint(shape, a);
        const d = Math.hypot(pt.x - worldPoint.x, pt.y - worldPoint.y);
        if (d < bestDist) {
          bestDist = d;
          bestAnchor = a;
        }
      }
      this.handleAnchorPointerDown({ event, shape, anchor: bestAnchor });
      return;
    }

    const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!this.isShapeSelected(shape.id)) {
      this.selectShape(shape.id, isMultiSelect);
    } else if (isMultiSelect) {
      this.selectShape(shape.id, true);
      return;
    }

    this.isMovingShapes = true;
    this.moveStartPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
    this.shapeInitialPositions.clear();
    this.isAltDragPending = event.altKey;
    this.hasClonedForAltDrag = false;

    const selectedIds = this.selectedShapeIds();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of this.shapes()) {
      if (selectedIds.has(s.id)) {
        this.shapeInitialPositions.set(s.id, { x: s.x, y: s.y });
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.width);
        maxY = Math.max(maxY, s.y + s.height);
      }
    }
    this.initialMovingBounds =
      isFinite(minX) && isFinite(minY)
        ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
        : null;

    this.connectionInitialWaypoints.clear();
    for (const c of this.connections()) {
      const isSelfLoop =
        c.targetShapeId && c.sourceShapeId === c.targetShapeId && selectedIds.has(c.sourceShapeId);
      const isBothEndpoints =
        c.targetShapeId && selectedIds.has(c.sourceShapeId) && selectedIds.has(c.targetShapeId);

      if ((isSelfLoop || isBothEndpoints) && c.waypoints?.length) {
        this.connectionInitialWaypoints.set(
          c.id,
          c.waypoints.map((p) => ({ ...p })),
        );
      }
    }

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  // Pointer event handlers on resize handles
  handleResizePointerDown(event: PointerEvent, handle: ResizeHandlePosition): void {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();

    const selectedIds = this.selectedShapeIds();
    if (selectedIds.size !== 1) {
      return;
    }

    const shapeId = Array.from(selectedIds)[0];
    const shape = this.shapes().find((s) => s.id === shapeId);
    if (!shape) {
      return;
    }

    this.isResizing = true;
    this.activeResizeHandle = handle;
    this.resizeStartPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
    this.resizeInitialShape = { ...shape };

    try {
      (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
    } catch {
      // Ignored
    }
  }

  handlePointerDown(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Handle touch pinch gesture start if 2 pointers
    if (this.activePointers.size === 2) {
      const [p1, p2] = Array.from(this.activePointers.values());
      this.initialPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.initialPinchZoom = this.zoom();
      this.isPanning.set(true);
      return;
    }

    const isMiddleClick = event.button === 1;
    const isRightClick = event.button === 2;
    const isSpaceLeftDrag = event.button === 0 && this.isSpacePressed;

    if (isMiddleClick || isRightClick || isSpaceLeftDrag) {
      this.isPanning.set(true);
      this.hasDraggedDuringPan = false;
      this.lastPointerPos = { x: event.clientX, y: event.clientY };
      try {
        (event.currentTarget as HTMLElement)?.setPointerCapture(event.pointerId);
      } catch {
        // Ignored if capture unsupported
      }
      return;
    }

    // Prevent canvas interactions if clicking inside floating docks or UI controls
    const target = event.target as HTMLElement | null;
    if (target?.closest('.canvas-tools-dock') || target?.closest('.canvas-controls-dock')) {
      return;
    }

    // Left click on empty canvas
    if (event.button === 0) {
      const worldPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
      const currentTool = this.activeTool();

      // If a connection was in-progress and user clicked on empty canvas:
      const inProg = this.inProgressConnection();
      if (inProg) {
        this.createConnection(
          inProg.sourceShapeId,
          inProg.sourceAnchor,
          undefined,
          undefined,
          worldPoint,
        );
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
        return;
      }

      if (currentTool !== 'select' && currentTool !== 'connection') {
        const newShape = this.createShape(currentTool as ShapeType, worldPoint);
        this.isMovingShapes = true;
        this.moveStartPoint = worldPoint;
        this.shapeInitialPositions.clear();
        this.shapeInitialPositions.set(newShape.id, { x: newShape.x, y: newShape.y });
        this.isAltDragPending = false;
        this.hasClonedForAltDrag = false;
        this.initialMovingBounds = {
          minX: newShape.x,
          minY: newShape.y,
          maxX: newShape.x + newShape.width,
          maxY: newShape.y + newShape.height,
          width: newShape.width,
          height: newShape.height,
        };
        try {
          (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
        } catch {
          // Ignored
        }
        return;
      }

      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        this.clearSelection();
      }

      if (currentTool === 'select') {
        this.marqueeStart = worldPoint;
        this.marqueeBox.set({
          minX: worldPoint.x,
          minY: worldPoint.y,
          maxX: worldPoint.x,
          maxY: worldPoint.y,
          width: 0,
          height: 0,
        });

        try {
          (this.elementRef.nativeElement as HTMLElement)?.setPointerCapture(event.pointerId);
        } catch {
          // Ignored
        }
      }
    }
  }

  handlePointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    // Two finger pinch zoom & pan
    if (this.activePointers.size === 2 && this.initialPinchDistance) {
      const [p1, p2] = Array.from(this.activePointers.values());
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      const focal: CanvasPoint = {
        x: (p1.x + p2.x) / 2 - rect.left,
        y: (p1.y + p2.y) / 2 - rect.top,
      };

      const scale = currentDistance / this.initialPinchDistance;
      this.zoomTo(this.initialPinchZoom * scale, focal);
      return;
    }

    // Canvas Panning
    if (this.isPanning() && this.lastPointerPos) {
      const deltaX = event.clientX - this.lastPointerPos.x;
      const deltaY = event.clientY - this.lastPointerPos.y;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        this.hasDraggedDuringPan = true;
      }

      this.panBy(deltaX, deltaY);
      this.lastPointerPos = { x: event.clientX, y: event.clientY };
      return;
    }

    const currentWorld = this.screenToWorld({ x: event.clientX, y: event.clientY });

    // In-progress connection drawing
    const inProg = this.inProgressConnection();
    if (inProg) {
      const sourceShape = this.shapes().find((s) => s.id === inProg.sourceShapeId);
      if (sourceShape) {
        const startPoint = getShapeAnchorPoint(sourceShape, inProg.sourceAnchor);
        let endPoint = currentWorld;
        let targetShapeId: string | undefined;
        let targetAnchor: AnchorPosition | undefined;

        // 1. Try hoveredAnchor if available and not the exact same handle
        const isHoveredSameHandle =
          this.hoveredAnchor &&
          this.hoveredAnchor.shape.id === inProg.sourceShapeId &&
          this.hoveredAnchor.anchor === inProg.sourceAnchor;

        if (this.hoveredAnchor && !isHoveredSameHandle) {
          endPoint = getShapeAnchorPoint(this.hoveredAnchor.shape, this.hoveredAnchor.anchor);
          targetShapeId = this.hoveredAnchor.shape.id;
          targetAnchor = this.hoveredAnchor.anchor;
        } else {
          // 2. Proximity geometric snapping (within 24px)
          const snapped = this.findNearestAnchor(
            currentWorld,
            inProg.sourceShapeId,
            24,
            inProg.sourceAnchor,
          );
          if (snapped) {
            endPoint = snapped.point;
            targetShapeId = snapped.shape.id;
            targetAnchor = snapped.anchor;
          }
        }

        const isSelfLoop =
          targetShapeId === inProg.sourceShapeId &&
          targetAnchor !== undefined &&
          targetAnchor !== inProg.sourceAnchor;

        const shapeBounds =
          isSelfLoop && sourceShape
            ? {
                x: sourceShape.x,
                y: sourceShape.y,
                width: sourceShape.width,
                height: sourceShape.height,
              }
            : undefined;

        const { path } = computeConnectionPath(
          startPoint,
          endPoint,
          'orthogonal',
          inProg.sourceAnchor,
          targetAnchor,
          undefined,
          shapeBounds,
          isSelfLoop,
        );

        this.inProgressConnection.set({
          ...inProg,
          currentPoint: endPoint,
          targetShapeId,
          targetAnchor,
          path,
        });
      }
      return;
    }

    // Orthogonal Segment dragging (Miro-style 1D displacement with magnetic alignment snapping)
    if (
      this.isDraggingSegment &&
      this.activeSegmentConnId &&
      this.activeSegmentIndex !== null &&
      this.activeSegmentOrientation &&
      this.segmentDragInitialPoints.length >= 2
    ) {
      const conn = this.connections().find((c) => c.id === this.activeSegmentConnId);
      if (conn) {
        const segIdx = this.activeSegmentIndex;
        const pts = this.segmentDragInitialPoints.map((p) => ({ ...p }));
        if (segIdx < pts.length - 1) {
          const SNAP_THRESHOLD = 12;

          if (this.activeSegmentOrientation === 'horizontal') {
            // Horizontal segment moves vertically (targetY)
            let targetY = Math.round(currentWorld.y);

            // Snap targets: check neighboring horizontal coordinates (e.g. endpoints or neighboring bends)
            const snapTargets: number[] = [];
            if (segIdx > 1) {
              snapTargets.push(pts[segIdx - 2].y);
            }
            if (segIdx + 2 < pts.length) {
              snapTargets.push(pts[segIdx + 2].y);
            }
            // Also check start and end points
            snapTargets.push(pts[0].y, pts[pts.length - 1].y);

            for (const snapY of snapTargets) {
              if (Math.abs(targetY - snapY) <= SNAP_THRESHOLD) {
                targetY = snapY;
                break;
              }
            }

            pts[segIdx].y = targetY;
            pts[segIdx + 1].y = targetY;
          } else {
            // Vertical segment moves horizontally (targetX)
            let targetX = Math.round(currentWorld.x);

            // Snap targets: check neighboring vertical coordinates
            const snapTargets: number[] = [];
            if (segIdx > 1) {
              snapTargets.push(pts[segIdx - 2].x);
            }
            if (segIdx + 2 < pts.length) {
              snapTargets.push(pts[segIdx + 2].x);
            }
            // Also check start and end points
            snapTargets.push(pts[0].x, pts[pts.length - 1].x);

            for (const snapX of snapTargets) {
              if (Math.abs(targetX - snapX) <= SNAP_THRESHOLD) {
                targetX = snapX;
                break;
              }
            }

            pts[segIdx].x = targetX;
            pts[segIdx + 1].x = targetX;
          }

          // Extract inner points as waypoints (exclude start and end endpoints)
          const newWaypoints = pts.slice(1, -1);
          this.updateConnection(conn.id, { waypoints: newWaypoints });
        }
      }
      return;
    }

    // Waypoint dragging (for curved and straight lines)
    if (this.isDraggingWaypoint && this.activeWaypointConnId && this.activeWaypointIndex !== null) {
      const conn = this.connections().find((c) => c.id === this.activeWaypointConnId);
      if (conn && conn.waypoints) {
        const updatedWaypoints = [...conn.waypoints];
        updatedWaypoints[this.activeWaypointIndex] = {
          x: Math.round(currentWorld.x),
          y: Math.round(currentWorld.y),
        };
        this.updateConnection(conn.id, { waypoints: updatedWaypoints });
      }
      return;
    }

    // Endpoint reconnect dragging preview
    const dragEnd = this.draggingEndpoint();
    if (dragEnd) {
      const conn = this.connections().find((c) => c.id === dragEnd.connId);
      if (conn) {
        const shapeMap = new Map(this.shapes().map((s) => [s.id, s]));

        if (dragEnd.endpoint === 'target') {
          // Fixed source
          const sourceShape = shapeMap.get(conn.sourceShapeId);
          if (sourceShape) {
            const startPoint = getShapeAnchorPoint(sourceShape, conn.sourceAnchor);
            let endPoint = currentWorld;
            let targetShapeId: string | undefined;
            let targetAnchor: AnchorPosition | undefined;

            // 1. Try hoveredAnchor if available and not same handle
            const isHoveredSameHandle =
              this.hoveredAnchor &&
              this.hoveredAnchor.shape.id === conn.sourceShapeId &&
              this.hoveredAnchor.anchor === conn.sourceAnchor;

            if (this.hoveredAnchor && !isHoveredSameHandle) {
              endPoint = getShapeAnchorPoint(this.hoveredAnchor.shape, this.hoveredAnchor.anchor);
              targetShapeId = this.hoveredAnchor.shape.id;
              targetAnchor = this.hoveredAnchor.anchor;
            } else {
              // 2. Proximity geometric snapping (within 24px)
              const snapped = this.findNearestAnchor(
                currentWorld,
                conn.sourceShapeId,
                24,
                conn.sourceAnchor,
              );
              if (snapped) {
                endPoint = snapped.point;
                targetShapeId = snapped.shape.id;
                targetAnchor = snapped.anchor;
              }
            }

            const isSelfLoop =
              targetShapeId === conn.sourceShapeId &&
              targetAnchor !== undefined &&
              targetAnchor !== conn.sourceAnchor;

            const shapeBounds =
              isSelfLoop && sourceShape
                ? {
                    x: sourceShape.x,
                    y: sourceShape.y,
                    width: sourceShape.width,
                    height: sourceShape.height,
                  }
                : undefined;

            const { path } = computeConnectionPath(
              startPoint,
              endPoint,
              conn.routing,
              conn.sourceAnchor,
              targetAnchor,
              undefined,
              shapeBounds,
              isSelfLoop,
            );

            this.reconnectingPreview.set({
              connId: conn.id,
              endpoint: 'target',
              startPoint,
              endPoint,
              currentPoint: endPoint,
              path,
              startMarker: conn.startMarker === 'arrow',
              endMarker: conn.endMarker === 'arrow',
              sourceShapeId: conn.sourceShapeId,
              sourceAnchor: conn.sourceAnchor,
              targetShapeId,
              targetAnchor,
            });
          }
        } else {
          // Fixed target (dragging source)
          let endPoint: CanvasPoint;
          let targetShape: CanvasShape | undefined;
          if (conn.targetShapeId && shapeMap.has(conn.targetShapeId) && conn.targetAnchor) {
            targetShape = shapeMap.get(conn.targetShapeId)!;
            endPoint = getShapeAnchorPoint(targetShape, conn.targetAnchor);
          } else if (conn.targetPoint) {
            endPoint = conn.targetPoint;
          } else {
            endPoint = currentWorld;
          }

          let startPoint = currentWorld;
          let sourceShapeId: string | undefined;
          let sourceAnchor: AnchorPosition | undefined;

          // 1. Try hoveredAnchor
          const isHoveredSameHandle =
            this.hoveredAnchor &&
            conn.targetShapeId &&
            this.hoveredAnchor.shape.id === conn.targetShapeId &&
            this.hoveredAnchor.anchor === conn.targetAnchor;

          if (this.hoveredAnchor && !isHoveredSameHandle) {
            startPoint = getShapeAnchorPoint(this.hoveredAnchor.shape, this.hoveredAnchor.anchor);
            sourceShapeId = this.hoveredAnchor.shape.id;
            sourceAnchor = this.hoveredAnchor.anchor;
          } else {
            // 2. Proximity geometric snapping
            const snapped = this.findNearestAnchor(
              currentWorld,
              conn.targetShapeId ?? '',
              24,
              conn.targetAnchor,
            );
            if (snapped) {
              startPoint = snapped.point;
              sourceShapeId = snapped.shape.id;
              sourceAnchor = snapped.anchor;
            }
          }

          const isSelfLoop =
            sourceShapeId !== undefined &&
            sourceShapeId === conn.targetShapeId &&
            sourceAnchor !== undefined &&
            sourceAnchor !== conn.targetAnchor;

          const shapeBounds =
            isSelfLoop && targetShape
              ? {
                  x: targetShape.x,
                  y: targetShape.y,
                  width: targetShape.width,
                  height: targetShape.height,
                }
              : undefined;

          const { path } = computeConnectionPath(
            startPoint,
            endPoint,
            conn.routing,
            sourceAnchor,
            conn.targetAnchor,
            undefined,
            shapeBounds,
            isSelfLoop,
          );

          this.reconnectingPreview.set({
            connId: conn.id,
            endpoint: 'source',
            startPoint,
            endPoint,
            currentPoint: startPoint,
            path,
            startMarker: conn.startMarker === 'arrow',
            endMarker: conn.endMarker === 'arrow',
            sourceShapeId,
            sourceAnchor,
            targetShapeId: conn.targetShapeId,
            targetAnchor: conn.targetAnchor,
          });
        }
      }
      return;
    }

    // Moving shapes
    if (this.isMovingShapes && this.moveStartPoint) {
      const rawDeltaX = currentWorld.x - this.moveStartPoint.x;
      const rawDeltaY = currentWorld.y - this.moveStartPoint.y;

      if (this.isAltDragPending && !this.hasClonedForAltDrag) {
        if (Math.hypot(rawDeltaX, rawDeltaY) >= 3) {
          this.performAltDragClone();
        } else {
          return;
        }
      }

      let deltaX = rawDeltaX;
      let deltaY = rawDeltaY;

      const shouldSnap = !event.altKey || this.hasClonedForAltDrag;
      if (this.initialMovingBounds && shouldSnap) {
        const selectedIds = this.selectedShapeIds();
        const otherShapes = this.shapes().filter((s) => !selectedIds.has(s.id));
        const gridSize =
          this.backgroundType() === BoardBackgroundType.GridLines
            ? CANVAS_CONSTANTS.GRID_SIZE
            : this.backgroundType() === BoardBackgroundType.GridDots
              ? CANVAS_CONSTANTS.DOT_GRID_SIZE
              : undefined;

        const snap = computeShapeMovementSnapping(
          this.initialMovingBounds,
          otherShapes,
          rawDeltaX,
          rawDeltaY,
          8,
          gridSize,
        );
        deltaX = snap.snappedDeltaX;
        deltaY = snap.snappedDeltaY;
        this.alignmentGuides.set(snap.guides);
      } else {
        this.alignmentGuides.set([]);
      }

      this.shapes.update((list) =>
        list.map((shape) => {
          const initial = this.shapeInitialPositions.get(shape.id);
          if (initial) {
            return {
              ...shape,
              x: Math.round(initial.x + deltaX),
              y: Math.round(initial.y + deltaY),
            };
          }
          return shape;
        }),
      );

      if (this.connectionInitialWaypoints.size > 0) {
        this.connections.update((list) =>
          list.map((c) => {
            const initialWps = this.connectionInitialWaypoints.get(c.id);
            if (initialWps) {
              return {
                ...c,
                waypoints: initialWps.map((p) => ({
                  x: Math.round(p.x + deltaX),
                  y: Math.round(p.y + deltaY),
                })),
              };
            }
            return c;
          }),
        );
      }
      return;
    }

    // Resizing shape
    if (
      this.isResizing &&
      this.resizeStartPoint &&
      this.resizeInitialShape &&
      this.activeResizeHandle
    ) {
      const keep1to1 = event.ctrlKey || event.metaKey;
      const shouldSnap = !event.altKey;
      this.applyResize(currentWorld, event.shiftKey, keep1to1, shouldSnap);
      return;
    }

    // Drag selection marquee
    if (this.marqueeStart) {
      const minX = Math.min(this.marqueeStart.x, currentWorld.x);
      const minY = Math.min(this.marqueeStart.y, currentWorld.y);
      const maxX = Math.max(this.marqueeStart.x, currentWorld.x);
      const maxY = Math.max(this.marqueeStart.y, currentWorld.y);

      this.marqueeBox.set({
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  }

  handlePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);

    if (this.activePointers.size < 2) {
      this.initialPinchDistance = null;
    }

    if (this.activePointers.size === 0) {
      if (this.hasDraggedDuringPan && event.button === 2) {
        this.preventContextMenuUntil = Date.now() + 400;
      }
      this.isPanning.set(false);
      this.lastPointerPos = null;
    }

    // Finish in-progress connection
    const inProg = this.inProgressConnection();
    if (inProg) {
      const dragDistance = this.connectionStartScreenPos
        ? Math.hypot(
            event.clientX - this.connectionStartScreenPos.x,
            event.clientY - this.connectionStartScreenPos.y,
          )
        : 0;

      // If user dragged (> 5px), finalize the connection on pointer up
      if (dragDistance > 5) {
        const currentWorld = this.screenToWorld({ x: event.clientX, y: event.clientY });
        if (inProg.targetShapeId && inProg.targetAnchor) {
          if (
            inProg.targetShapeId !== inProg.sourceShapeId ||
            inProg.targetAnchor !== inProg.sourceAnchor
          ) {
            this.createConnection(
              inProg.sourceShapeId,
              inProg.sourceAnchor,
              inProg.targetShapeId,
              inProg.targetAnchor,
            );
          } else {
            this.createConnection(
              inProg.sourceShapeId,
              inProg.sourceAnchor,
              undefined,
              undefined,
              currentWorld,
            );
          }
        } else {
          // Connect to empty world point
          this.createConnection(
            inProg.sourceShapeId,
            inProg.sourceAnchor,
            undefined,
            undefined,
            currentWorld,
          );
        }
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
      }
      // If dragDistance <= 5px, it was a click to start! Keep inProgressConnection active
      // so user can click a target anchor or shape to complete the connection.
    }

    if (this.isDraggingSegment) {
      this.isDraggingSegment = false;
      this.activeSegmentConnId = null;
      this.activeSegmentIndex = null;
      this.activeSegmentOrientation = null;
      this.segmentDragInitialPoints = [];
    }

    if (this.isDraggingWaypoint) {
      this.isDraggingWaypoint = false;
      this.activeWaypointConnId = null;
      this.activeWaypointIndex = null;
      this.isNewWaypoint = false;
    }

    const preview = this.reconnectingPreview();
    if (preview && this.draggingEndpoint()) {
      const conn = this.connections().find((c) => c.id === preview.connId);
      if (conn) {
        if (preview.endpoint === 'target') {
          if (preview.targetShapeId && preview.targetAnchor) {
            this.updateConnection(conn.id, {
              targetShapeId: preview.targetShapeId,
              targetAnchor: preview.targetAnchor,
              targetPoint: undefined,
              waypoints: undefined,
            });
          } else {
            this.updateConnection(conn.id, {
              targetShapeId: undefined,
              targetAnchor: undefined,
              targetPoint: preview.currentPoint,
              waypoints: undefined,
            });
          }
        } else {
          // Dragging source: must connect to a valid shape anchor
          if (preview.sourceShapeId && preview.sourceAnchor) {
            this.updateConnection(conn.id, {
              sourceShapeId: preview.sourceShapeId,
              sourceAnchor: preview.sourceAnchor,
              waypoints: undefined,
            });
          } else if (this.initialReconnectingConn) {
            this.updateConnection(conn.id, {
              sourceShapeId: this.initialReconnectingConn.sourceShapeId,
              sourceAnchor: this.initialReconnectingConn.sourceAnchor,
            });
          }
        }
      }

      this.reconnectingPreview.set(null);
      this.draggingEndpoint.set(null);
      this.initialReconnectingConn = null;
    } else if (this.draggingEndpoint()) {
      this.draggingEndpoint.set(null);
      this.reconnectingPreview.set(null);
      this.initialReconnectingConn = null;
    }

    if (this.isMovingShapes) {
      this.isMovingShapes = false;
      this.moveStartPoint = null;
      this.initialMovingBounds = null;
      this.alignmentGuides.set([]);
      this.shapeInitialPositions.clear();
      this.connectionInitialWaypoints.clear();
    }
    this.isAltDragPending = false;
    this.hasClonedForAltDrag = false;

    if (this.isResizing) {
      this.isResizing = false;
      this.activeResizeHandle = null;
      this.resizeStartPoint = null;
      this.resizeInitialShape = null;
      this.alignmentGuides.set([]);
    }

    if (this.marqueeStart) {
      const box = this.marqueeBox();
      if (box && box.width > 2 && box.height > 2) {
        const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;
        const matchingIds = new Set<string>(isMultiSelect ? this.selectedShapeIds() : []);
        for (const shape of this.shapes()) {
          const intersects =
            shape.x < box.maxX &&
            shape.x + shape.width > box.minX &&
            shape.y < box.maxY &&
            shape.y + shape.height > box.minY;

          if (intersects) {
            matchingIds.add(shape.id);
          }
        }
        this.selectedShapeIds.set(matchingIds);
      }
      this.marqueeStart = null;
      this.marqueeBox.set(null);
    }
  }

  private applyResize(
    currentWorld: CanvasPoint,
    maintainAspectRatio: boolean,
    keep1to1 = false,
    shouldSnap = true,
  ): void {
    if (!this.resizeInitialShape || !this.resizeStartPoint || !this.activeResizeHandle) {
      return;
    }

    const init = this.resizeInitialShape;
    const rawDeltaX = currentWorld.x - this.resizeStartPoint.x;
    const rawDeltaY = currentWorld.y - this.resizeStartPoint.y;
    const handle = this.activeResizeHandle;

    if (!shouldSnap) {
      this.alignmentGuides.set([]);
      const res = computeShapeResizeSnapping(
        init,
        handle,
        rawDeltaX,
        rawDeltaY,
        [],
        0,
        maintainAspectRatio,
        keep1to1,
      );
      this.shapes.update((list) =>
        list.map((s) =>
          s.id === init.id
            ? {
                ...s,
                x: res.newX,
                y: res.newY,
                width: res.newWidth,
                height: res.newHeight,
              }
            : s,
        ),
      );
      return;
    }

    const otherShapes = this.shapes().filter((s) => s.id !== init.id);

    const res = computeShapeResizeSnapping(
      init,
      handle,
      rawDeltaX,
      rawDeltaY,
      otherShapes,
      8,
      maintainAspectRatio,
      keep1to1,
    );

    this.alignmentGuides.set(res.guides);

    this.shapes.update((list) =>
      list.map((s) =>
        s.id === init.id
          ? {
              ...s,
              x: res.newX,
              y: res.newY,
              width: res.newWidth,
              height: res.newHeight,
            }
          : s,
      ),
    );
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.code === 'Space' || event.key === ' ') {
      this.isSpacePressed = true;
    }

    if (event.key === 'Escape') {
      if (this.isResizing && this.resizeInitialShape) {
        const initial = this.resizeInitialShape;
        this.shapes.update((list) => list.map((s) => (s.id === initial.id ? { ...initial } : s)));
        this.isResizing = false;
        this.activeResizeHandle = null;
        this.resizeStartPoint = null;
        this.resizeInitialShape = null;
        this.alignmentGuides.set([]);
        return;
      }
      if (this.draggingEndpoint() && this.initialReconnectingConn) {
        this.updateConnection(this.initialReconnectingConn.id, {
          sourceShapeId: this.initialReconnectingConn.sourceShapeId,
          sourceAnchor: this.initialReconnectingConn.sourceAnchor,
          targetShapeId: this.initialReconnectingConn.targetShapeId,
          targetAnchor: this.initialReconnectingConn.targetAnchor,
          targetPoint: this.initialReconnectingConn.targetPoint,
          waypoints: this.initialReconnectingConn.waypoints,
        });
        this.draggingEndpoint.set(null);
        this.reconnectingPreview.set(null);
        this.initialReconnectingConn = null;
        return;
      }
      if (this.inProgressConnection()) {
        this.inProgressConnection.set(null);
        this.connectionStartScreenPos = null;
      }
      this.setActiveTool('select');
      this.clearSelection();
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'v' || event.key === 'V') {
        this.setActiveTool('select');
        return;
      }
      if (event.key === 'c' || event.key === 'C') {
        this.setActiveTool('connection');
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        this.setActiveTool('rectangle');
        return;
      }
      if (event.key === 'o' || event.key === 'O') {
        this.setActiveTool('ellipse');
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        this.setActiveTool('diamond');
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        this.deleteSelectedShapes();
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoomIn();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault();
      this.resetZoom();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'g' || event.key === 'G')) {
      event.preventDefault();
      if (event.shiftKey) {
        this.ungroupSelectedShapes();
      } else {
        this.groupSelectedShapes();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === ']') {
      event.preventDefault();
      if (event.shiftKey) {
        this.bringToFront();
      } else {
        this.bringForward();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === '[') {
      event.preventDefault();
      if (event.shiftKey) {
        this.sendToBack();
      } else {
        this.sendBackward();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
      event.preventDefault();
      this.copy();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'x' || event.key === 'X')) {
      event.preventDefault();
      this.cut();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) {
      event.preventDefault();
      this.paste();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'd' || event.key === 'D')) {
      event.preventDefault();
      this.duplicate();
      return;
    }

    const selectedCount = this.selectedShapeIds().size;
    const step = event.shiftKey ? 10 : 1;

    if (selectedCount > 0) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.nudgeSelectedShapes(0, -step);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.nudgeSelectedShapes(0, step);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.nudgeSelectedShapes(-step, 0);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.nudgeSelectedShapes(step, 0);
        return;
      }
    } else {
      const panStep = event.shiftKey ? 50 : 20;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.panBy(0, panStep);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.panBy(0, -panStep);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.panBy(panStep, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.panBy(-panStep, 0);
      }
    }
  }

  nudgeSelectedShapes(deltaX: number, deltaY: number): void {
    const selected = this.selectedShapeIds();
    this.shapes.update((list) =>
      list.map((s) => (selected.has(s.id) ? { ...s, x: s.x + deltaX, y: s.y + deltaY } : s)),
    );

    this.connections.update((list) =>
      list.map((c) => {
        const isSelfLoop =
          c.targetShapeId && c.sourceShapeId === c.targetShapeId && selected.has(c.sourceShapeId);
        const isBothEndpoints =
          c.targetShapeId && selected.has(c.sourceShapeId) && selected.has(c.targetShapeId);

        if ((isSelfLoop || isBothEndpoints) && c.waypoints?.length) {
          return {
            ...c,
            waypoints: c.waypoints.map((p) => ({
              x: Math.round(p.x + deltaX),
              y: Math.round(p.y + deltaY),
            })),
          };
        }
        return c;
      }),
    );
  }

  alignSelectedShapes(alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    const selected = this.selectedShapeIds();
    if (selected.size < 2) {
      return;
    }

    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    if (selectedShapes.length < 2) {
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const s of selectedShapes) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.shapes.update((list) =>
      list.map((s) => {
        if (!selected.has(s.id)) {
          return s;
        }
        let newX = s.x;
        let newY = s.y;

        switch (alignment) {
          case 'left':
            newX = minX;
            break;
          case 'center':
            newX = Math.round(centerX - s.width / 2);
            break;
          case 'right':
            newX = maxX - s.width;
            break;
          case 'top':
            newY = minY;
            break;
          case 'middle':
            newY = Math.round(centerY - s.height / 2);
            break;
          case 'bottom':
            newY = maxY - s.height;
            break;
        }

        return { ...s, x: newX, y: newY };
      }),
    );
  }

  distributeSelectedShapes(direction: 'horizontal' | 'vertical'): void {
    const selected = this.selectedShapeIds();
    if (selected.size < 3) {
      return;
    }

    const selectedShapes = this.shapes().filter((s) => selected.has(s.id));
    if (selectedShapes.length < 3) {
      return;
    }

    if (direction === 'horizontal') {
      const sorted = [...selectedShapes].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.x + last.width - first.x;
      const totalWidths = sorted.reduce((sum, s) => sum + s.width, 0);
      const totalGap = totalSpan - totalWidths;
      const gap = totalGap / (sorted.length - 1);

      let currentX = first.x;
      const newXMap = new Map<string, number>();
      for (const s of sorted) {
        newXMap.set(s.id, Math.round(currentX));
        currentX += s.width + gap;
      }

      this.shapes.update((list) =>
        list.map((s) => {
          if (newXMap.has(s.id)) {
            return { ...s, x: newXMap.get(s.id)! };
          }
          return s;
        }),
      );
    } else {
      const sorted = [...selectedShapes].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.y + last.height - first.y;
      const totalHeights = sorted.reduce((sum, s) => sum + s.height, 0);
      const totalGap = totalSpan - totalHeights;
      const gap = totalGap / (sorted.length - 1);

      let currentY = first.y;
      const newYMap = new Map<string, number>();
      for (const s of sorted) {
        newYMap.set(s.id, Math.round(currentY));
        currentY += s.height + gap;
      }

      this.shapes.update((list) =>
        list.map((s) => {
          if (newYMap.has(s.id)) {
            return { ...s, y: newYMap.get(s.id)! };
          }
          return s;
        }),
      );
    }
  }

  handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.key === ' ') {
      this.isSpacePressed = false;
    }
  }

  handleBlur(): void {
    this.isSpacePressed = false;
    this.alignmentGuides.set([]);
  }

  private emitTransformChange(): void {
    this.transformChange.emit({
      zoom: this.zoom(),
      panX: this.panX(),
      panY: this.panY(),
    });
  }
}
