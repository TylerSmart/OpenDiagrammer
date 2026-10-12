import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { CanvasComponent } from './canvas.component';
import { CANVAS_CONSTANTS } from './canvas.models';

describe('CanvasComponent', () => {
  let component: CanvasComponent;
  let fixture: ComponentFixture<CanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create canvas component', () => {
    expect(component).toBeTruthy();
    expect(component.zoom()).toBe(CANVAS_CONSTANTS.DEFAULT_ZOOM);
    expect(component.panX()).toBe(0);
    expect(component.panY()).toBe(0);
    expect(component.zoomPercentage()).toBe('100%');
  });

  it('should clamp zoom within MIN_ZOOM and MAX_ZOOM bounds', () => {
    component.zoomTo(10.0);
    expect(component.zoom()).toBe(CANVAS_CONSTANTS.MAX_ZOOM);

    component.zoomTo(0.01);
    expect(component.zoom()).toBe(CANVAS_CONSTANTS.MIN_ZOOM);
  });

  it('should zoom in and zoom out via buttons', () => {
    const initialZoom = component.zoom();
    component.zoomIn();
    expect(component.zoom()).toBeGreaterThan(initialZoom);

    component.zoomOut();
    expect(component.zoom()).toBeCloseTo(initialZoom, 2);
  });

  it('should reset zoom and reset view correctly', () => {
    component.zoomTo(2.5);
    component.panBy(150, -80);
    expect(component.zoom()).toBe(2.5);
    expect(component.panX()).toBe(150);
    expect(component.panY()).toBe(-80);

    component.resetView();
    expect(component.zoom()).toBe(CANVAS_CONSTANTS.DEFAULT_ZOOM);
    expect(component.panX()).toBe(0);
    expect(component.panY()).toBe(0);
  });

  it('should pan canvas when panBy is invoked', () => {
    component.panBy(50, 100);
    expect(component.panX()).toBe(50);
    expect(component.panY()).toBe(100);

    component.panBy(-20, -40);
    expect(component.panX()).toBe(30);
    expect(component.panY()).toBe(60);
  });

  it('should convert screen coordinates to world and back accurately', () => {
    // With zoom = 2, panX = 100, panY = 50
    component.zoom.set(2);
    component.panX.set(100);
    component.panY.set(50);

    const rect = fixture.nativeElement.getBoundingClientRect();
    const screenPoint = { x: rect.left + 200, y: rect.top + 150 };

    const world = component.screenToWorld(screenPoint);
    // relativeX = 200, relativeY = 150
    // worldX = (200 - 100) / 2 = 50
    // worldY = (150 - 50) / 2 = 50
    expect(world.x).toBeCloseTo(50, 2);
    expect(world.y).toBeCloseTo(50, 2);

    const backToScreen = component.worldToScreen(world);
    expect(backToScreen.x).toBeCloseTo(screenPoint.x, 2);
    expect(backToScreen.y).toBeCloseTo(screenPoint.y, 2);
  });

  it('should handle wheel event for panning and zooming with ctrlKey', () => {
    const initialPanX = component.panX();
    const initialPanY = component.panY();

    const normalWheelEvent = new WheelEvent('wheel', {
      deltaX: 40,
      deltaY: 60,
      cancelable: true,
    });
    component.handleWheel(normalWheelEvent);

    expect(component.panX()).toBe(initialPanX - 40);
    expect(component.panY()).toBe(initialPanY - 60);

    const initialZoom = component.zoom();
    const zoomWheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      cancelable: true,
    });
    component.handleWheel(zoomWheelEvent);
    expect(component.zoom()).toBeGreaterThan(initialZoom);

    // Shift + wheel converts vertical scroll to horizontal panning
    const curPanX = component.panX();
    const curPanY = component.panY();
    const shiftWheelEvent = new WheelEvent('wheel', {
      deltaY: 50,
      shiftKey: true,
      cancelable: true,
    });
    component.handleWheel(shiftWheelEvent);
    expect(component.panX()).toBe(curPanX - 50);
    expect(component.panY()).toBe(curPanY);
  });

  it('should handle pointer drag panning with middle click, right click, or space+left click', () => {
    // Left-click without space should NOT pan
    const leftClickEvent = new PointerEvent('pointerdown', {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    component.handlePointerDown(leftClickEvent);
    expect(component.isPanning()).toBe(false);

    // Left-click with space pressed SHOULD pan
    component.isSpacePressed = true;
    component.handlePointerDown(leftClickEvent);
    expect(component.isPanning()).toBe(true);

    const moveEvent = new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 140,
      clientY: 170,
    });
    component.handlePointerMove(moveEvent);
    expect(component.panX()).toBe(40);
    expect(component.panY()).toBe(70);

    const upEvent = new PointerEvent('pointerup', {
      pointerId: 1,
      clientX: 140,
      clientY: 170,
    });
    component.handlePointerUp(upEvent);
    expect(component.isPanning()).toBe(false);

    // Right-click drag pans
    const rightClickEvent = new PointerEvent('pointerdown', {
      pointerId: 2,
      button: 2,
      clientX: 200,
      clientY: 200,
    });
    component.handlePointerDown(rightClickEvent);
    expect(component.isPanning()).toBe(true);

    const rightMoveEvent = new PointerEvent('pointermove', {
      pointerId: 2,
      clientX: 230,
      clientY: 240,
    });
    component.handlePointerMove(rightMoveEvent);

    component.handlePointerUp(
      new PointerEvent('pointerup', { pointerId: 2, button: 2, clientX: 230, clientY: 240 }),
    );
    expect(component.isPanning()).toBe(false);

    // Verify context menu is prevented right after dragging
    const contextMenuEvent = new MouseEvent('contextmenu', { cancelable: true });
    const spy = vi.spyOn(contextMenuEvent, 'preventDefault');
    component.handleContextMenu(contextMenuEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('should handle keyboard navigation shortcuts', () => {
    // Arrow keys
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.panX()).toBe(-20);

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.panX()).toBe(0);

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.panY()).toBe(20);

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.panY()).toBe(0);

    // Ctrl + '+' zoom in
    const prevZoom = component.zoom();
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '+', ctrlKey: true }));
    expect(component.zoom()).toBeGreaterThan(prevZoom);

    // Ctrl + '0' reset zoom
    component.handleKeyDown(new KeyboardEvent('keydown', { key: '0', ctrlKey: true }));
    expect(component.zoom()).toBe(CANVAS_CONSTANTS.DEFAULT_ZOOM);
  });

  it('should compute background styles based on input properties', () => {
    fixture.componentRef.setInput('backgroundType', BoardBackgroundType.GridLines);
    fixture.componentRef.setInput('backgroundColor', '#f0f0f0');
    fixture.componentRef.setInput('backgroundOpacity', 0.8);
    fixture.detectChanges();

    const styles = component.backgroundStyles();
    expect(styles.backgroundColor).toBe('#f0f0f0');
    expect(styles.opacity).toBe('0.8');
    expect(styles.backgroundSize).toBe('32px 32px');
    expect(component.isGridLines()).toBe(true);
    expect(component.isGridDots()).toBe(false);

    fixture.componentRef.setInput('backgroundType', BoardBackgroundType.GridDots);
    fixture.detectChanges();
    expect(component.isGridDots()).toBe(true);
    expect(component.isGridLines()).toBe(false);

    // Test adaptive grid scaling at different zoom levels
    // At zoom 1.0, base size is 24px (24px is within [18, 72])
    expect(component.backgroundStyles().backgroundSize).toBe('24px 24px');

    // At extreme zoom out 0.1: baseSize * 0.1 = 2.4px -> multiplier becomes 8 -> 19.2px
    component.zoom.set(0.1);
    const zoomedOutSize = parseFloat(component.backgroundStyles().backgroundSize || '0');
    expect(zoomedOutSize).toBeGreaterThanOrEqual(18);
    expect(zoomedOutSize).toBeLessThanOrEqual(72);

    // At extreme zoom in 4.0: baseSize * 4.0 = 96px -> multiplier becomes 0.5 -> 48px
    component.zoom.set(4.0);
    const zoomedInSize = parseFloat(component.backgroundStyles().backgroundSize || '0');
    expect(zoomedInSize).toBeGreaterThanOrEqual(18);
    expect(zoomedInSize).toBeLessThanOrEqual(72);
  });

  it('should create and select shapes using tools', () => {
    component.setActiveTool('rectangle');
    expect(component.activeTool()).toBe('rectangle');

    const shape = component.createShape('rectangle', { x: 200, y: 150 });
    expect(component.shapes().length).toBe(1);
    expect(shape.type).toBe('rectangle');
    expect(component.isShapeSelected(shape.id)).toBe(true);
    expect(component.activeTool()).toBe('select');

    // Selection bounding box should match shape bounds
    const box = component.selectionBox();
    expect(box).not.toBeNull();
    expect(box?.minX).toBe(shape.x);
    expect(box?.minY).toBe(shape.y);
  });

  it('should select multiple shapes and clear selection', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('ellipse', { x: 300, y: 200 });

    component.selectShape(s1.id, false);
    expect(component.selectedShapeIds().size).toBe(1);
    expect(component.isShapeSelected(s1.id)).toBe(true);

    // Multi-select s2
    component.selectShape(s2.id, true);
    expect(component.selectedShapeIds().size).toBe(2);
    expect(component.isShapeSelected(s1.id)).toBe(true);
    expect(component.isShapeSelected(s2.id)).toBe(true);

    // Clear selection
    component.clearSelection();
    expect(component.selectedShapeIds().size).toBe(0);
    expect(component.selectionBox()).toBeNull();
  });

  it('should delete selected shapes', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    component.selectShape(s1.id);
    component.deleteSelectedShapes();

    expect(component.shapes().length).toBe(0);
    expect(component.selectedShapeIds().size).toBe(0);
  });

  it('should move shapes with pointer drag and nudge with arrow keys', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    component.selectShape(s1.id);

    // Pointer down on shape
    const downEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    component.handleShapePointerDown(downEvent, s1);

    // Pointer move
    const moveEvent = new PointerEvent('pointermove', {
      clientX: 140,
      clientY: 130,
    });
    component.handlePointerMove(moveEvent);

    const upEvent = new PointerEvent('pointerup', { button: 0 });
    component.handlePointerUp(upEvent);

    const movedShape = component.shapes().find((s) => s.id === s1.id);
    expect(movedShape?.x).toBe(s1.x + 40);
    expect(movedShape?.y).toBe(s1.y + 30);

    // Nudge with Arrow keys
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    const nudgedShape = component.shapes().find((s) => s.id === s1.id);
    expect(nudgedShape?.x).toBe((movedShape?.x ?? 0) + 1);
  });

  it('should resize shape via resize handle', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    component.selectShape(s1.id);

    // Start resize with SE handle
    const downEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: s1.x + s1.width,
      clientY: s1.y + s1.height,
    });
    component.handleResizePointerDown(downEvent, 'se');

    // Drag handle outward by 50px
    const moveEvent = new PointerEvent('pointermove', {
      clientX: s1.x + s1.width + 50,
      clientY: s1.y + s1.height + 40,
    });
    component.handlePointerMove(moveEvent);

    const upEvent = new PointerEvent('pointerup', { button: 0 });
    component.handlePointerUp(upEvent);

    const resizedShape = component.shapes().find((s) => s.id === s1.id);
    expect(resizedShape?.width).toBe(s1.width + 50);
    expect(resizedShape?.height).toBe(s1.height + 40);

    // Resize with Ctrl held to force 1:1 square
    const downEvent2 = new PointerEvent('pointerdown', {
      button: 0,
      clientX: resizedShape!.x + resizedShape!.width,
      clientY: resizedShape!.y + resizedShape!.height,
    });
    component.handleResizePointerDown(downEvent2, 'se');

    const moveEvent2 = new PointerEvent('pointermove', {
      clientX: resizedShape!.x + resizedShape!.width + 60,
      clientY: resizedShape!.y + resizedShape!.height + 20,
      ctrlKey: true,
    });
    component.handlePointerMove(moveEvent2);
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    const squareShape = component.shapes().find((s) => s.id === s1.id);
    expect(squareShape?.width).toBe(squareShape?.height);
  });

  it('should select shapes via marquee drag selection', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('diamond', { x: 400, y: 400 });
    component.clearSelection();

    // Drag marquee covering s1 but not s2
    const downEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    component.handlePointerDown(downEvent);

    const moveEvent = new PointerEvent('pointermove', {
      clientX: 250,
      clientY: 250,
    });
    component.handlePointerMove(moveEvent);
    expect(component.marqueeBox()).not.toBeNull();

    const upEvent = new PointerEvent('pointerup', { button: 0 });
    component.handlePointerUp(upEvent);

    expect(component.marqueeBox()).toBeNull();
    expect(component.isShapeSelected(s1.id)).toBe(true);
    expect(component.isShapeSelected(s2.id)).toBe(false);
  });

  it('should create and render connections between shapes', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('ellipse', { x: 400, y: 100 });

    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');
    expect(component.connections().length).toBe(1);
    expect(conn.sourceShapeId).toBe(s1.id);
    expect(conn.targetShapeId).toBe(s2.id);

    const rendered = component.renderedConnections();
    expect(rendered.length).toBe(1);
    expect(rendered[0].id).toBe(conn.id);
    expect(rendered[0].path).toContain('M');

    // Selection
    expect(component.isConnectionSelected(conn.id)).toBe(true);
    component.clearSelection();
    expect(component.isConnectionSelected(conn.id)).toBe(false);

    component.selectConnection(conn.id);
    expect(component.isConnectionSelected(conn.id)).toBe(true);
  });

  it('should dynamically update connection paths when connected shapes move', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });

    const _conn = component.createConnection(s1.id, 'right', s2.id, 'left');
    const initialPath = component.renderedConnections()[0].path;

    // Move s1
    component.selectShape(s1.id);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    const updatedPath = component.renderedConnections()[0].path;
    expect(updatedPath).not.toBe(initialPath);
  });

  it('should delete connections when either connected shape is deleted', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    component.createConnection(s1.id, 'right', s2.id, 'left');
    expect(component.connections().length).toBe(1);

    component.selectShape(s1.id);
    component.deleteSelectedShapes();

    expect(component.shapes().length).toBe(1);
    expect(component.connections().length).toBe(0);
  });

  it('should create connection via dragging from an anchor point', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });

    // Anchor down on s1 right anchor
    const anchorEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: s1.x + s1.width,
      clientY: s1.y + s1.height / 2,
    });
    component.handleAnchorPointerDown({
      event: anchorEvent,
      shape: s1,
      anchor: 'right',
    });

    expect(component.inProgressConnection()).not.toBeNull();

    // Hover over s2 left anchor
    component.handleAnchorHover({ shape: s2, anchor: 'left' });

    // Pointer move
    const moveEvent = new PointerEvent('pointermove', {
      clientX: s2.x,
      clientY: s2.y + s2.height / 2,
    });
    component.handlePointerMove(moveEvent);

    // Pointer up to complete connection
    const upEvent = new PointerEvent('pointerup', {
      button: 0,
      clientX: s2.x,
      clientY: s2.y + s2.height / 2,
    });
    component.handlePointerUp(upEvent);

    expect(component.inProgressConnection()).toBeNull();
    expect(component.connections().length).toBe(1);
    const newConn = component.connections()[0];
    expect(newConn.sourceShapeId).toBe(s1.id);
    expect(newConn.targetShapeId).toBe(s2.id);
    expect(newConn.targetAnchor).toBe('left');
  });
});
