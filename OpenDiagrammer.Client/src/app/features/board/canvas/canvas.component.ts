import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { CANVAS_CONSTANTS, CanvasPoint, CanvasTransform } from './canvas.models';
import {
  AnchorPosition,
  CanvasConnection,
  computeConnectionPath,
  getShapeAnchorPoint,
} from './connection.models';
import {
  ActiveTool,
  BoundingBox,
  CanvasShape,
  ResizeHandlePosition,
  SHAPE_CONSTANTS,
  ShapeType,
} from './shape.models';
import { CanvasShapeComponent } from './shape/canvas-shape.component';

interface RenderedConnection {
  id: string;
  path: string;
  strokeColor: string;
  strokeWidth: number;
  dashArray?: string;
  endMarker?: string;
}

@Component({
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, CanvasShapeComponent],
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
  // Inputs for board settings
  readonly backgroundType = input<BoardBackgroundType>(BoardBackgroundType.GridLines);
  readonly backgroundColor = input<string | null>('transparent');
  readonly backgroundOpacity = input<number>(1);

  // Transform change output event
  readonly transformChange = output<CanvasTransform>();

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

  private hoveredAnchor: { shape: CanvasShape; anchor: AnchorPosition } | null = null;

  // Marquee selection state
  readonly marqueeBox = signal<BoundingBox | null>(null);
  private marqueeStart: CanvasPoint | null = null;

  // Node movement state
  private isMovingShapes = false;
  private moveStartPoint: CanvasPoint | null = null;
  private shapeInitialPositions = new Map<string, CanvasPoint>();

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

      const path = computeConnectionPath(
        start,
        end,
        conn.routing,
        conn.sourceAnchor,
        conn.targetAnchor,
      );

      let dashArray: string | undefined;
      if (conn.pattern === 'dashed') {
        dashArray = '6,4';
      } else if (conn.pattern === 'dotted') {
        dashArray = '2,3';
      }

      result.push({
        id: conn.id,
        path,
        strokeColor: conn.strokeColor,
        strokeWidth: conn.strokeWidth,
        dashArray,
      });
    }

    return result;
  });

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
      backgroundColor: this.backgroundColor() || 'transparent',
      opacity: `${this.backgroundOpacity()}`,
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

  handleWheel(event: WheelEvent): void {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      const focalPoint: CanvasPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const zoomFactor = Math.exp(-event.deltaY * 0.005);
      this.zoomTo(this.zoom() * zoomFactor, focalPoint);
    } else if (event.shiftKey) {
      const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
      this.panBy(-delta, 0);
    } else {
      this.panBy(-event.deltaX, -event.deltaY);
    }
  }

  // Shape Management & Selection API
  isShapeSelected(id: string): boolean {
    return this.selectedShapeIds().has(id);
  }

  setActiveTool(tool: ActiveTool): void {
    this.activeTool.set(tool);
  }

  clearSelection(): void {
    this.selectedShapeIds.set(new Set<string>());
    this.selectedConnectionIds.set(new Set<string>());
  }

  selectShape(id: string, multiSelect = false): void {
    const current = new Set(this.selectedShapeIds());
    if (multiSelect) {
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
    } else {
      current.clear();
      current.add(id);
    }
    this.selectedShapeIds.set(current);
    this.selectedConnectionIds.set(new Set<string>());
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
    this.activeTool.set('select');
    return newShape;
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
    }
    this.selectedConnectionIds.set(current);
    this.selectedShapeIds.set(new Set<string>());
  }

  createConnection(
    sourceShapeId: string,
    sourceAnchor: AnchorPosition,
    targetShapeId?: string,
    targetAnchor?: AnchorPosition,
    targetPoint?: CanvasPoint,
  ): CanvasConnection {
    const newConn: CanvasConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceShapeId,
      sourceAnchor,
      targetShapeId,
      targetAnchor,
      targetPoint,
      routing: 'orthogonal',
      strokeColor: '#333333',
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
    this.selectConnection(connId, event.shiftKey);
  }

  handleAnchorPointerDown(payload: {
    event: PointerEvent;
    shape: CanvasShape;
    anchor: AnchorPosition;
  }): void {
    if (payload.event.button !== 0 || this.isSpacePressed) {
      return;
    }

    payload.event.stopPropagation();

    const startPoint = getShapeAnchorPoint(payload.shape, payload.anchor);
    const initialPath = computeConnectionPath(startPoint, startPoint, 'orthogonal', payload.anchor);

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

  // Pointer event handlers on shapes
  handleShapePointerDown(event: PointerEvent, shape: CanvasShape): void {
    if (event.button !== 0 || this.isSpacePressed) {
      return;
    }

    event.stopPropagation();

    if (this.activeTool() === 'connection') {
      // Start connection from center or nearest anchor on click
      this.handleAnchorPointerDown({ event, shape, anchor: 'right' });
      return;
    }

    if (!this.isShapeSelected(shape.id)) {
      this.selectShape(shape.id, event.shiftKey);
    } else if (event.shiftKey) {
      this.selectShape(shape.id, true);
      return;
    }

    this.isMovingShapes = true;
    this.moveStartPoint = this.screenToWorld({ x: event.clientX, y: event.clientY });
    this.shapeInitialPositions.clear();

    const selectedIds = this.selectedShapeIds();
    for (const s of this.shapes()) {
      if (selectedIds.has(s.id)) {
        this.shapeInitialPositions.set(s.id, { x: s.x, y: s.y });
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

      if (currentTool !== 'select' && currentTool !== 'connection') {
        this.createShape(currentTool as ShapeType, worldPoint);
        return;
      }

      if (!event.shiftKey) {
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
        let targetAnchor: AnchorPosition | undefined;

        if (this.hoveredAnchor && this.hoveredAnchor.shape.id !== inProg.sourceShapeId) {
          endPoint = getShapeAnchorPoint(this.hoveredAnchor.shape, this.hoveredAnchor.anchor);
          targetAnchor = this.hoveredAnchor.anchor;
        }

        const path = computeConnectionPath(
          startPoint,
          endPoint,
          'orthogonal',
          inProg.sourceAnchor,
          targetAnchor,
        );

        this.inProgressConnection.set({
          ...inProg,
          currentPoint: endPoint,
          targetShapeId: this.hoveredAnchor?.shape.id,
          targetAnchor,
          path,
        });
      }
      return;
    }

    // Moving shapes
    if (this.isMovingShapes && this.moveStartPoint) {
      const deltaX = currentWorld.x - this.moveStartPoint.x;
      const deltaY = currentWorld.y - this.moveStartPoint.y;

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
      this.applyResize(currentWorld, event.shiftKey, keep1to1);
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
      const currentWorld = this.screenToWorld({ x: event.clientX, y: event.clientY });
      if (inProg.targetShapeId && inProg.targetAnchor) {
        this.createConnection(
          inProg.sourceShapeId,
          inProg.sourceAnchor,
          inProg.targetShapeId,
          inProg.targetAnchor,
        );
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
      this.activeTool.set('select');
    }

    if (this.isMovingShapes) {
      this.isMovingShapes = false;
      this.moveStartPoint = null;
      this.shapeInitialPositions.clear();
    }

    if (this.isResizing) {
      this.isResizing = false;
      this.activeResizeHandle = null;
      this.resizeStartPoint = null;
      this.resizeInitialShape = null;
    }

    if (this.marqueeStart) {
      const box = this.marqueeBox();
      if (box && box.width > 2 && box.height > 2) {
        const matchingIds = new Set<string>(event.shiftKey ? this.selectedShapeIds() : []);
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
  ): void {
    if (!this.resizeInitialShape || !this.resizeStartPoint || !this.activeResizeHandle) {
      return;
    }

    const init = this.resizeInitialShape;
    const deltaX = currentWorld.x - this.resizeStartPoint.x;
    const deltaY = currentWorld.y - this.resizeStartPoint.y;
    const handle = this.activeResizeHandle;

    let newX = init.x;
    let newY = init.y;
    let newWidth = init.width;
    let newHeight = init.height;

    if (handle.includes('e')) {
      newWidth = Math.max(SHAPE_CONSTANTS.MIN_WIDTH, init.width + deltaX);
    } else if (handle.includes('w')) {
      const potentialWidth = init.width - deltaX;
      if (potentialWidth >= SHAPE_CONSTANTS.MIN_WIDTH) {
        newWidth = potentialWidth;
        newX = init.x + deltaX;
      } else {
        newWidth = SHAPE_CONSTANTS.MIN_WIDTH;
        newX = init.x + (init.width - SHAPE_CONSTANTS.MIN_WIDTH);
      }
    }

    if (handle.includes('s')) {
      newHeight = Math.max(SHAPE_CONSTANTS.MIN_HEIGHT, init.height + deltaY);
    } else if (handle.includes('n')) {
      const potentialHeight = init.height - deltaY;
      if (potentialHeight >= SHAPE_CONSTANTS.MIN_HEIGHT) {
        newHeight = potentialHeight;
        newY = init.y + deltaY;
      } else {
        newHeight = SHAPE_CONSTANTS.MIN_HEIGHT;
        newY = init.y + (init.height - SHAPE_CONSTANTS.MIN_HEIGHT);
      }
    }

    // When holding Ctrl (keep1to1), force Width === Height (1:1 perfect square/circle)
    if (keep1to1) {
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
    } else if (maintainAspectRatio && init.width > 0 && init.height > 0) {
      const aspectRatio = init.width / init.height;
      if (handle === 'e' || handle === 'w') {
        newHeight = newWidth / aspectRatio;
      } else if (handle === 'n' || handle === 's') {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
      }
    }

    this.shapes.update((list) =>
      list.map((s) =>
        s.id === init.id
          ? {
              ...s,
              x: Math.round(newX),
              y: Math.round(newY),
              width: Math.round(newWidth),
              height: Math.round(newHeight),
            }
          : s,
      ),
    );
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.key === ' ') {
      this.isSpacePressed = true;
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

  private nudgeSelectedShapes(deltaX: number, deltaY: number): void {
    const selected = this.selectedShapeIds();
    this.shapes.update((list) =>
      list.map((s) => (selected.has(s.id) ? { ...s, x: s.x + deltaX, y: s.y + deltaY } : s)),
    );
  }

  handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.key === ' ') {
      this.isSpacePressed = false;
    }
  }

  handleBlur(): void {
    this.isSpacePressed = false;
  }

  private emitTransformChange(): void {
    this.transformChange.emit({
      zoom: this.zoom(),
      panX: this.panX(),
      panY: this.panY(),
    });
  }
}
