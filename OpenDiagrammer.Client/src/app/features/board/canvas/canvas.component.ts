import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { CANVAS_CONSTANTS, CanvasPoint, CanvasTransform } from './canvas.models';

@Component({
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  selector: 'app-canvas',
  styleUrl: './canvas.component.scss',
  templateUrl: './canvas.component.html',
  host: {
    tabindex: '0',
    '(keydown)': 'handleKeyDown($event)',
    '(wheel)': 'handleWheel($event)',
    '(pointerdown)': 'handlePointerDown($event)',
    '(pointermove)': 'handlePointerMove($event)',
    '(pointerup)': 'handlePointerUp($event)',
    '(pointercancel)': 'handlePointerUp($event)',
    '(contextmenu)': 'handleContextMenu($event)',
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

  // Interaction tracking state
  readonly isPanning = signal<boolean>(false);
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

  // Background styling computed
  readonly backgroundStyles = computed(() => {
    const scale = this.zoom();
    const bgType = this.backgroundType();
    const panX = this.panX();
    const panY = this.panY();

    let bgSize = '';
    if (bgType === BoardBackgroundType.GridLines) {
      const size = CANVAS_CONSTANTS.GRID_SIZE * scale;
      bgSize = `${size}px ${size}px`;
    } else if (bgType === BoardBackgroundType.GridDots) {
      const size = CANVAS_CONSTANTS.DOT_GRID_SIZE * scale;
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

    // Keep world coordinate under focal point fixed:
    // focalScreen = world * currentZoom + currentPan
    // => world = (focalScreen - currentPan) / currentZoom
    // newPan = focalScreen - world * newZoom
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
    // Prevent default context menu when right-click dragging
    if (this.isPanning()) {
      event.preventDefault();
    }
  }

  handleWheel(event: WheelEvent): void {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      // Zoom with ctrl + wheel (or pinch gesture on trackpads)
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      const focalPoint: CanvasPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      // Zoom factor calculation
      const zoomFactor = Math.exp(-event.deltaY * 0.005);
      this.zoomTo(this.zoom() * zoomFactor, focalPoint);
    } else {
      // Pan with normal wheel / two-finger scroll
      this.panBy(-event.deltaX, -event.deltaY);
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

    // Pan with middle click (button 1), right click (button 2), or spacebar + left click
    const isMiddleClick = event.button === 1;
    const isRightClick = event.button === 2;
    const isSpaceOrLeftDrag =
      event.button === 0 &&
      (event.shiftKey || (event.target as HTMLElement)?.classList.contains('canvas-viewport-area'));

    if (isMiddleClick || isRightClick || isSpaceOrLeftDrag) {
      this.isPanning.set(true);
      this.lastPointerPos = { x: event.clientX, y: event.clientY };
      try {
        (event.currentTarget as HTMLElement)?.setPointerCapture(event.pointerId);
      } catch {
        // Ignored if capture unsupported
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

    if (!this.isPanning() || !this.lastPointerPos) {
      return;
    }

    const deltaX = event.clientX - this.lastPointerPos.x;
    const deltaY = event.clientY - this.lastPointerPos.y;

    this.panBy(deltaX, deltaY);
    this.lastPointerPos = { x: event.clientX, y: event.clientY };
  }

  handlePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);

    if (this.activePointers.size < 2) {
      this.initialPinchDistance = null;
    }

    if (this.activePointers.size === 0) {
      this.isPanning.set(false);
      this.lastPointerPos = null;
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    // Zoom in with Ctrl + '+' or '='
    if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.zoomIn();
      return;
    }

    // Zoom out with Ctrl + '-'
    if ((event.ctrlKey || event.metaKey) && event.key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    // Reset zoom with Ctrl + '0'
    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault();
      this.resetZoom();
      return;
    }

    // Arrow keys pan
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

  private emitTransformChange(): void {
    this.transformChange.emit({
      zoom: this.zoom(),
      panX: this.panX(),
      panY: this.panY(),
    });
  }
}
