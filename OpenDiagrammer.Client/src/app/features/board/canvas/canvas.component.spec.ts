import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { CanvasComponent } from './canvas.component';
import { CANVAS_CONSTANTS } from './canvas.models';
import { getShapeAnchorPoint } from './connection.models';

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

  it('should resize shape via OS-window style edge strips and corner handles', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    component.selectShape(s1.id);

    // Test East edge resize (horizontal only)
    const downEast = new PointerEvent('pointerdown', {
      button: 0,
      clientX: s1.x + s1.width,
      clientY: s1.y + s1.height / 2,
    });
    component.handleResizePointerDown(downEast, 'e');

    const moveEast = new PointerEvent('pointermove', {
      clientX: s1.x + s1.width + 30,
      clientY: s1.y + s1.height / 2 + 25, // vertical movement should be ignored for pure horizontal edge
    });
    component.handlePointerMove(moveEast);
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    const shapeAfterEast = component.shapes().find((s) => s.id === s1.id);
    expect(shapeAfterEast?.width).toBe(s1.width + 30);
    expect(shapeAfterEast?.height).toBe(s1.height);

    // Test South edge resize (vertical only)
    const downSouth = new PointerEvent('pointerdown', {
      button: 0,
      clientX: shapeAfterEast!.x + shapeAfterEast!.width / 2,
      clientY: shapeAfterEast!.y + shapeAfterEast!.height,
    });
    component.handleResizePointerDown(downSouth, 's');

    const moveSouth = new PointerEvent('pointermove', {
      clientX: shapeAfterEast!.x + shapeAfterEast!.width / 2 + 15, // horizontal movement ignored
      clientY: shapeAfterEast!.y + shapeAfterEast!.height + 40,
    });
    component.handlePointerMove(moveSouth);
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    const shapeAfterSouth = component.shapes().find((s) => s.id === s1.id);
    expect(shapeAfterSouth?.width).toBe(s1.width + 30);
    expect(shapeAfterSouth?.height).toBe(s1.height + 40);

    // Test Corner SE resize (both horizontal and vertical)
    const downSE = new PointerEvent('pointerdown', {
      button: 0,
      clientX: shapeAfterSouth!.x + shapeAfterSouth!.width,
      clientY: shapeAfterSouth!.y + shapeAfterSouth!.height,
    });
    component.handleResizePointerDown(downSE, 'se');

    const moveSE = new PointerEvent('pointermove', {
      clientX: shapeAfterSouth!.x + shapeAfterSouth!.width + 20,
      clientY: shapeAfterSouth!.y + shapeAfterSouth!.height + 20,
    });
    component.handlePointerMove(moveSE);
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    const finalShape = component.shapes().find((s) => s.id === s1.id);
    expect(finalShape?.width).toBe(s1.width + 50);
    expect(finalShape?.height).toBe(s1.height + 60);
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

  it('should create connection via two consecutive clicks (click-to-connect)', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });

    component.setActiveTool('connection');

    // Click 1: Click s1 right anchor (without dragging)
    const anchor1Event = new PointerEvent('pointerdown', {
      button: 0,
      clientX: s1.x + s1.width,
      clientY: s1.y + s1.height / 2,
    });
    component.handleAnchorPointerDown({
      event: anchor1Event,
      shape: s1,
      anchor: 'right',
    });

    const up1Event = new PointerEvent('pointerup', {
      button: 0,
      clientX: s1.x + s1.width,
      clientY: s1.y + s1.height / 2,
    });
    component.handlePointerUp(up1Event);

    // Connection remains in progress waiting for next target!
    expect(component.inProgressConnection()).not.toBeNull();
    expect(component.inProgressConnection()?.sourceShapeId).toBe(s1.id);

    // Click 2: Click s2 left anchor
    const anchor2Event = new PointerEvent('pointerdown', {
      button: 0,
      clientX: s2.x,
      clientY: s2.y + s2.height / 2,
    });
    component.handleAnchorPointerDown({
      event: anchor2Event,
      shape: s2,
      anchor: 'left',
    });

    expect(component.inProgressConnection()).toBeNull();
    expect(component.connections().length).toBe(1);
    expect(component.activeTool()).toBe('select');
  });

  it('should magnetically snap to nearest target anchor during drag', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });

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

    const s2LeftAnchor = { x: s2.x, y: s2.y + s2.height / 2 };
    const nearScreenPoint = component.worldToScreen({
      x: s2LeftAnchor.x - 10,
      y: s2LeftAnchor.y,
    });

    const nearEvent = new PointerEvent('pointermove', {
      clientX: nearScreenPoint.x,
      clientY: nearScreenPoint.y,
    });
    component.handlePointerMove(nearEvent);

    const inProg = component.inProgressConnection();
    expect(inProg).not.toBeNull();
    expect(inProg?.targetShapeId).toBe(s2.id);
    expect(inProg?.targetAnchor).toBe('left');
  });

  it('should cancel in-progress connection on Escape key', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    component.setActiveTool('connection');
    component.handleAnchorPointerDown({
      event: new PointerEvent('pointerdown', { button: 0 }),
      shape: s1,
      anchor: 'top',
    });

    expect(component.inProgressConnection()).not.toBeNull();

    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.inProgressConnection()).toBeNull();
    expect(component.activeTool()).toBe('select');
  });

  it('should customize connection routing, pattern, markers, color, and stroke width', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    expect(component.singleSelectedConnection()?.id).toBe(conn.id);

    // Change routing
    component.setConnectionRouting('curved');
    expect(component.connections()[0].routing).toBe('curved');

    component.setConnectionRouting('straight');
    expect(component.connections()[0].routing).toBe('straight');

    // Change pattern
    component.setConnectionPattern('dashed');
    expect(component.connections()[0].pattern).toBe('dashed');

    // Change markers
    component.setConnectionMarkers('both');
    expect(component.connections()[0].startMarker).toBe('arrow');
    expect(component.connections()[0].endMarker).toBe('arrow');

    component.setConnectionMarkers('none');
    expect(component.connections()[0].startMarker).toBe('none');
    expect(component.connections()[0].endMarker).toBe('none');

    // Change color and width
    component.setConnectionColor('#1976d2');
    component.setConnectionWidth(4);
    expect(component.connections()[0].strokeColor).toBe('#1976d2');
    expect(component.connections()[0].strokeWidth).toBe(4);
  });

  it('should support connection text labels and editing', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.startEditingConnectionText(conn.id);
    expect(component.editingConnectionId()).toBe(conn.id);

    component.finishEditingConnectionText(conn.id, 'Connects Service A to B');
    expect(component.editingConnectionId()).toBeNull();
    expect(component.connections()[0].text).toBe('Connects Service A to B');
  });

  it('should insert, drag, and remove waypoints on selected connection', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    // Drag midpoint handle to insert waypoint
    const screenPt = component.worldToScreen({ x: 250, y: 100 });
    component.handleMidpointPointerDown(
      new PointerEvent('pointerdown', { button: 0, clientX: screenPt.x, clientY: screenPt.y }),
      conn.id,
      0,
    );

    expect(component.connections()[0].waypoints?.length).toBe(1);

    // Drag the waypoint down
    const newScreenPt = component.worldToScreen({ x: 250, y: 220 });
    component.handlePointerMove(
      new PointerEvent('pointermove', { clientX: newScreenPt.x, clientY: newScreenPt.y }),
    );
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    const updatedConn = component.connections()[0];
    expect(updatedConn.waypoints?.[0].y).toBeCloseTo(220, 0);

    // Remove waypoint via dblclick
    component.handleWaypointDblClick(new MouseEvent('dblclick'), conn.id, 0);
    expect(component.connections()[0].waypoints?.length).toBe(0);
  });

  it('should reconnect connection target to another shape via endpoint handle drag', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const s3 = component.createShape('rectangle', { x: 400, y: 300 });

    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');
    component.selectConnection(conn.id);

    expect(component.connections()[0].targetShapeId).toBe(s2.id);

    // Pointer down on target endpoint handle
    const s2LeftAnchor = { x: s2.x, y: s2.y + s2.height / 2 };
    const s2ScreenPt = component.worldToScreen(s2LeftAnchor);
    component.handleEndpointPointerDown(
      new PointerEvent('pointerdown', { button: 0, clientX: s2ScreenPt.x, clientY: s2ScreenPt.y }),
      conn.id,
      'target',
    );

    expect(component.draggingEndpoint()).toEqual({ connId: conn.id, endpoint: 'target' });
    expect(component.reconnectingPreview()).not.toBeNull();

    // Drag to s3 top anchor
    const s3TopAnchor = { x: s3.x + s3.width / 2, y: s3.y };
    const s3ScreenPt = component.worldToScreen(s3TopAnchor);
    component.handlePointerMove(
      new PointerEvent('pointermove', { clientX: s3ScreenPt.x, clientY: s3ScreenPt.y }),
    );
    fixture.detectChanges();

    // Live reconnecting preview line should be rendered in the DOM
    const previewEl = fixture.nativeElement.querySelector(
      '.connection-path.in-progress.reconnecting',
    );
    expect(previewEl).not.toBeNull();
    expect(component.reconnectingPreview()?.targetShapeId).toBe(s3.id);
    expect(component.reconnectingPreview()?.targetAnchor).toBe('top');

    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    expect(component.draggingEndpoint()).toBeNull();
    expect(component.reconnectingPreview()).toBeNull();
    const updated = component.connections()[0];
    expect(updated.targetShapeId).toBe(s3.id);
    expect(updated.targetAnchor).toBe('top');
  });

  it('should show preview line when reconnecting source endpoint and cancel on Escape', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const s3 = component.createShape('rectangle', { x: 100, y: 300 });

    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');
    component.selectConnection(conn.id);

    // Pointer down on source endpoint
    const s1RightAnchor = { x: s1.x + s1.width, y: s1.y + s1.height / 2 };
    const s1ScreenPt = component.worldToScreen(s1RightAnchor);
    component.handleEndpointPointerDown(
      new PointerEvent('pointerdown', { button: 0, clientX: s1ScreenPt.x, clientY: s1ScreenPt.y }),
      conn.id,
      'source',
    );

    expect(component.draggingEndpoint()).toEqual({ connId: conn.id, endpoint: 'source' });
    expect(component.reconnectingPreview()).not.toBeNull();

    // Move towards s3 top anchor
    const s3TopAnchor = { x: s3.x + s3.width / 2, y: s3.y };
    const s3ScreenPt = component.worldToScreen(s3TopAnchor);
    component.handlePointerMove(
      new PointerEvent('pointermove', { clientX: s3ScreenPt.x, clientY: s3ScreenPt.y }),
    );

    expect(component.reconnectingPreview()?.sourceShapeId).toBe(s3.id);
    expect(component.reconnectingPreview()?.sourceAnchor).toBe('top');

    // Press Escape to cancel reconnect
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(component.draggingEndpoint()).toBeNull();
    expect(component.reconnectingPreview()).toBeNull();
    // Connection source remains original s1
    expect(component.connections()[0].sourceShapeId).toBe(s1.id);
    expect(component.connections()[0].sourceAnchor).toBe('right');
  });

  it('should render endpoint reconnect handles and reshape handles only when connection is selected', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.clearSelection();
    component.hoveredConnectionId.set(conn.id);
    fixture.detectChanges();

    // When connection is only hovered (not selected), handles are not rendered so shape anchors are unobstructed
    const hoveredEndpoints = fixture.nativeElement.querySelectorAll('.connection-endpoint-handle');
    expect(hoveredEndpoints.length).toBe(0);

    const hoveredMidpoints = fixture.nativeElement.querySelectorAll(
      '.connection-segment-handle, .connection-midpoint-handle',
    );
    expect(hoveredMidpoints.length).toBe(0);

    // When connection is selected, handles ARE rendered
    component.selectConnection(conn.id);
    fixture.detectChanges();

    const selectedEndpoints = fixture.nativeElement.querySelectorAll('.connection-endpoint-handle');
    expect(selectedEndpoints.length).toBe(2);

    const selectedMidpoints = fixture.nativeElement.querySelectorAll(
      '.connection-segment-handle, .connection-midpoint-handle',
    );
    expect(selectedMidpoints.length).toBeGreaterThan(0);
  });

  it('should route orthogonal connections with outward clearance when sharing bottom-to-bottom anchors', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'bottom', s2.id, 'bottom');

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    expect(rendered).toBeDefined();

    // Shape center is y = 100, height = 80 -> top y = 60, bottom y = 140.
    // Clearance stub steps down below both shapes (140 + 20 = 160)
    expect(rendered!.points.length).toBe(4);
    expect(rendered!.points[0].y).toBe(140);
    expect(rendered!.points[1].y).toBe(160);
    expect(rendered!.points[2].y).toBe(160);
    expect(rendered!.points[3].y).toBe(140);
    expect(rendered!.path).toContain('L 100 160 L 400 160');
  });

  it('should smoothly interpolate curved connections through multiple waypoints using cubic Bezier spline', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 500, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.updateConnection(conn.id, {
      routing: 'curved',
      waypoints: [{ x: 300, y: 250 }],
    });

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    expect(rendered).toBeDefined();
    expect(rendered!.routing).toBe('curved');
    expect(rendered!.waypoints.length).toBe(1);
    // Path is a smooth continuous cubic Bezier curve (C) exiting perpendicular to anchors without hard linear joints (L)
    expect(rendered!.path).toContain('C');
    expect(rendered!.path).not.toContain('L');
  });

  it('should extract segments on orthogonal connections and support 1D segment dragging', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'bottom', s2.id, 'bottom');

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    expect(rendered).toBeDefined();
    // Segment 1 is the bottom horizontal line connecting the two legs (length = 300 >= 30)
    expect(rendered!.segments.length).toBeGreaterThan(0);
    const horizSeg = rendered!.segments.find((s) => s.orientation === 'horizontal');
    expect(horizSeg).toBeDefined();

    // Start dragging horizontal segment down (delta y to y = 220)
    const segScreenPt = component.worldToScreen(horizSeg!.midpoint);
    component.handleSegmentPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: segScreenPt.x,
        clientY: segScreenPt.y,
      }),
      conn.id,
      horizSeg!,
    );

    const movedScreenPt = component.worldToScreen({ x: horizSeg!.midpoint.x, y: 220 });
    component.handlePointerMove(
      new PointerEvent('pointermove', { clientX: movedScreenPt.x, clientY: movedScreenPt.y }),
    );
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    // Recomputed connection should have stepped down to y = 220
    const updated = component.renderedConnections().find((c) => c.id === conn.id);
    expect(updated).toBeDefined();
    const updatedPoints = updated!.points;
    expect(updatedPoints.some((p) => p.y === 220)).toBe(true);
  });

  it('should enforce minimum outward clearance length before turning on orthogonal connections', () => {
    // s1 at (100, 100), s2 placed below and to the right at (200, 300)
    // Connect from s1 right anchor to s2 top anchor
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 200, y: 300 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'top');

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    expect(rendered).toBeDefined();

    // s1 center (100, 100), width 120 -> right anchor x = 160, y = 100
    // Line must travel rightwards by at least 20px stub before making any vertical turn
    const pts = rendered!.points;
    expect(pts[0].x).toBe(160);
    expect(pts[0].y).toBe(100);
    // Next point must be at x >= 180 (160 + 20) with y = 100, coming straight out of the right side
    expect(pts[1].x).toBeGreaterThanOrEqual(180);
    expect(pts[1].y).toBe(100);
  });

  it('should magnetically snap to align with neighboring points when dragging within threshold', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 400, y: 100 });
    const conn = component.createConnection(s1.id, 'bottom', s2.id, 'bottom');

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    const horizSeg = rendered!.segments.find((s) => s.orientation === 'horizontal');
    expect(horizSeg).toBeDefined();

    // Bottom anchor y is 140. Start dragging horizontal segment near 140 (e.g. y = 145, which is within 12px)
    const segScreenPt = component.worldToScreen(horizSeg!.midpoint);
    component.handleSegmentPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: segScreenPt.x,
        clientY: segScreenPt.y,
      }),
      conn.id,
      horizSeg!,
    );

    const nearScreenPt = component.worldToScreen({ x: horizSeg!.midpoint.x, y: 145 });
    component.handlePointerMove(
      new PointerEvent('pointermove', { clientX: nearScreenPt.x, clientY: nearScreenPt.y }),
    );
    component.handlePointerUp(new PointerEvent('pointerup', { button: 0 }));

    // The segment should snap directly to y = 140, collapsing corners into a straight alignment
    const updated = component.renderedConnections().find((c) => c.id === conn.id);
    expect(updated).toBeDefined();
    // After collapsing, points will align at y = 140
    expect(updated!.points.every((p) => p.y === 140)).toBe(true);
  });

  it('should reset connection waypoints when resetConnectionWaypoints is called', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 300, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.updateConnection(conn.id, {
      waypoints: [
        { x: 200, y: 50 },
        { x: 250, y: 150 },
      ],
    });

    const connWithWaypoints = component.connections().find((c) => c.id === conn.id);
    expect(connWithWaypoints?.waypoints?.length).toBe(2);

    component.resetConnectionWaypoints(conn.id);

    const resetConn = component.connections().find((c) => c.id === conn.id);
    expect(resetConn?.waypoints?.length).toBe(0);
  });

  it('should reset connection waypoints when handleSegmentDblClick is called', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 300, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.updateConnection(conn.id, {
      waypoints: [{ x: 200, y: 200 }],
    });

    const dblClickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(dblClickEvent, 'stopPropagation');

    component.handleSegmentDblClick(dblClickEvent, conn.id);

    expect(stopSpy).toHaveBeenCalled();
    const resetConn = component.connections().find((c) => c.id === conn.id);
    expect(resetConn?.waypoints?.length).toBe(0);
  });

  it('should reset connection waypoints when double-clicking segment handle via consecutive pointerdowns', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 300, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.updateConnection(conn.id, {
      waypoints: [{ x: 200, y: 200 }],
    });

    const rendered = component.renderedConnections().find((c) => c.id === conn.id);
    expect(rendered?.segments?.length).toBeGreaterThan(0);
    const targetSegment = rendered!.segments![0];

    // First click
    const evt1 = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 200,
      clientY: 150,
      bubbles: true,
      cancelable: true,
    });
    component.handleSegmentPointerDown(evt1, conn.id, targetSegment);

    // Second click rapidly at same position
    const evt2 = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 201,
      clientY: 151,
      bubbles: true,
      cancelable: true,
    });
    component.handleSegmentPointerDown(evt2, conn.id, targetSegment);

    const resetConn = component.connections().find((c) => c.id === conn.id);
    expect(resetConn?.waypoints?.length).toBe(0);
  });

  it('should remove specific waypoint when double-clicking waypoint handle via consecutive pointerdowns', () => {
    const s1 = component.createShape('rectangle', { x: 100, y: 100 });
    const s2 = component.createShape('rectangle', { x: 300, y: 100 });
    const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

    component.updateConnection(conn.id, {
      routing: 'straight',
      waypoints: [
        { x: 150, y: 120 },
        { x: 250, y: 180 },
      ],
    });

    // First click on waypoint 0
    const evt1 = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 150,
      clientY: 120,
      bubbles: true,
      cancelable: true,
    });
    component.handleWaypointPointerDown(evt1, conn.id, 0);

    // Second click rapidly on waypoint 0
    const evt2 = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 151,
      clientY: 121,
      bubbles: true,
      cancelable: true,
    });
    component.handleWaypointPointerDown(evt2, conn.id, 0);

    const updatedConn = component.connections().find((c) => c.id === conn.id);
    expect(updatedConn?.waypoints?.length).toBe(1);
    expect(updatedConn?.waypoints?.[0]).toEqual({ x: 250, y: 180 });
  });

  describe('Self-Loop Connections', () => {
    it('should create a self-loop connection when source and target are the same shape with different handles', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const bottomPt = getShapeAnchorPoint(s1, 'bottom');
      const leftPt = getShapeAnchorPoint(s1, 'left');

      const conn = component.createConnection(s1.id, 'bottom', s1.id, 'left');

      expect(conn).toBeDefined();
      expect(conn.sourceShapeId).toBe(s1.id);
      expect(conn.targetShapeId).toBe(s1.id);
      expect(conn.sourceAnchor).toBe('bottom');
      expect(conn.targetAnchor).toBe('left');

      const rendered = component.renderedConnections().find((c) => c.id === conn.id);
      expect(rendered).toBeDefined();

      // Points should exit bottom, loop around outside the bottom-left corner, and enter left
      const pts = rendered!.points;
      expect(pts.length).toBeGreaterThanOrEqual(4);
      expect(pts[0]).toEqual(bottomPt);
      expect(pts[pts.length - 1]).toEqual(leftPt);

      // All intermediate points must stay strictly outside the shape interior
      for (let i = 1; i < pts.length - 1; i++) {
        const pt = pts[i];
        const insideInterior =
          pt.x > s1.x && pt.x < s1.x + s1.width && pt.y > s1.y && pt.y < s1.y + s1.height;
        expect(insideInterior).toBe(false);
      }
    });

    it('should reject creating a connection on the exact same connector handle', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });

      expect(() => {
        component.createConnection(s1.id, 'bottom', s1.id, 'bottom');
      }).toThrow('A connector cannot loop on the same connector handle');
    });

    it('should reject updating a connection to loop on the same handle', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const conn = component.createConnection(s1.id, 'bottom', s1.id, 'left');

      component.updateConnection(conn.id, { targetAnchor: 'bottom' });

      const updated = component.connections().find((c) => c.id === conn.id);
      // Target anchor should remain 'left', update rejected
      expect(updated?.targetAnchor).toBe('left');
    });

    it('should complete a self-loop when user clicks a different anchor on the same shape', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const bottomPt = getShapeAnchorPoint(s1, 'bottom');
      const leftPt = getShapeAnchorPoint(s1, 'left');

      // Start connection on bottom anchor
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', {
          button: 0,
          clientX: bottomPt.x,
          clientY: bottomPt.y,
        }),
        shape: s1,
        anchor: 'bottom',
      });

      expect(component.inProgressConnection()).toBeTruthy();
      expect(component.inProgressConnection()?.sourceShapeId).toBe(s1.id);
      expect(component.inProgressConnection()?.sourceAnchor).toBe('bottom');

      // Click left anchor on the same shape
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', { button: 0, clientX: leftPt.x, clientY: leftPt.y }),
        shape: s1,
        anchor: 'left',
      });

      // In-progress connection should be finalized
      expect(component.inProgressConnection()).toBeNull();

      const conns = component.connections();
      const selfConn = conns.find((c) => c.sourceShapeId === s1.id && c.targetShapeId === s1.id);
      expect(selfConn).toBeDefined();
      expect(selfConn?.sourceAnchor).toBe('bottom');
      expect(selfConn?.targetAnchor).toBe('left');
    });

    it('should NOT complete a connection when user clicks the exact same anchor', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const bottomPt = getShapeAnchorPoint(s1, 'bottom');

      // Start connection on bottom anchor
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', {
          button: 0,
          clientX: bottomPt.x,
          clientY: bottomPt.y,
        }),
        shape: s1,
        anchor: 'bottom',
      });

      expect(component.inProgressConnection()).toBeTruthy();

      // Click same bottom anchor again
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', {
          button: 0,
          clientX: bottomPt.x,
          clientY: bottomPt.y,
        }),
        shape: s1,
        anchor: 'bottom',
      });

      // No connection should be created on the same handle
      expect(component.connections().length).toBe(0);
    });

    it('should snap to different anchors on the same shape during dragging, but not the same handle', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const bottomPt = getShapeAnchorPoint(s1, 'bottom');
      const leftPt = getShapeAnchorPoint(s1, 'left');

      // Start connection at bottom anchor
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', {
          button: 0,
          clientX: bottomPt.x,
          clientY: bottomPt.y,
        }),
        shape: s1,
        anchor: 'bottom',
      });

      // Move near the starting bottom anchor - should NOT snap to bottom anchor
      component.handlePointerMove(
        new PointerEvent('pointermove', { clientX: bottomPt.x, clientY: bottomPt.y - 2 }),
      );
      const inProgNearSame = component.inProgressConnection();
      expect(inProgNearSame?.targetAnchor).toBeUndefined();

      // Move near the left anchor - should snap to left anchor
      component.handlePointerMove(
        new PointerEvent('pointermove', { clientX: leftPt.x + 2, clientY: leftPt.y }),
      );
      const inProgNearLeft = component.inProgressConnection();
      expect(inProgNearLeft?.targetShapeId).toBe(s1.id);
      expect(inProgNearLeft?.targetAnchor).toBe('left');
    });

    it('should render a curved self-loop outside the shape boundaries', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const conn = component.createConnection(s1.id, 'bottom', s1.id, 'left');
      component.updateConnection(conn.id, { routing: 'curved' });

      const rendered = component.renderedConnections().find((c) => c.id === conn.id);
      expect(rendered).toBeDefined();
      expect(rendered?.routing).toBe('curved');
      expect(rendered?.path).toContain('C');
      // Midpoint should be outside below the shape
      expect(rendered?.midpoint.x).toBeLessThan(s1.x + s1.width / 2);
      expect(rendered?.midpoint.y).toBeGreaterThan(s1.y + s1.height);
    });

    it('should move self-loop waypoints when the parent shape is moved', () => {
      const s1 = component.createShape('rectangle', { x: 160, y: 140 });
      const conn = component.createConnection(s1.id, 'bottom', s1.id, 'left');
      component.updateConnection(conn.id, {
        waypoints: [{ x: 50, y: 220 }],
      });

      // Select s1 and drag it by delta (+50, +50)
      component.selectShape(s1.id);

      component.handleShapePointerDown(
        new PointerEvent('pointerdown', { button: 0, clientX: 150, clientY: 150 }),
        s1,
      );

      component.handlePointerMove(new PointerEvent('pointermove', { clientX: 200, clientY: 200 }));

      const updatedConn = component.connections().find((c) => c.id === conn.id);
      expect(updatedConn?.waypoints?.[0]).toEqual({ x: 100, y: 270 });
    });

    it('should allow initiating a new connection from an anchor that already has an existing connection emerging from it', () => {
      const s1 = component.createShape('rectangle', { x: 100, y: 100 });
      const s2 = component.createShape('rectangle', { x: 400, y: 100 });
      component.createConnection(s1.id, 'right', s2.id, 'left');

      expect(component.connections().length).toBe(1);

      // Deselect connection so user is interacting with shapes
      component.clearSelection();
      fixture.detectChanges();

      // Shape anchor for right side should be accessible
      const rightPt = getShapeAnchorPoint(s1, 'right');
      const anchorEvent = new PointerEvent('pointerdown', {
        button: 0,
        clientX: rightPt.x,
        clientY: rightPt.y,
      });

      // Pointer down on the right anchor of s1
      component.handleAnchorPointerDown({
        event: anchorEvent,
        shape: s1,
        anchor: 'right',
      });

      // A new connection must be in progress from s1 right anchor
      const inProg = component.inProgressConnection();
      expect(inProg).not.toBeNull();
      expect(inProg?.sourceShapeId).toBe(s1.id);
      expect(inProg?.sourceAnchor).toBe('right');

      // Now click on a different anchor on s1 to create a self-loop
      const bottomPt = getShapeAnchorPoint(s1, 'bottom');
      component.handleAnchorPointerDown({
        event: new PointerEvent('pointerdown', {
          button: 0,
          clientX: bottomPt.x,
          clientY: bottomPt.y,
        }),
        shape: s1,
        anchor: 'bottom',
      });

      // Now 2 connections exist: the original one and the new self loop!
      expect(component.connections().length).toBe(2);
      const newConn = component.connections()[1];
      expect(newConn.sourceShapeId).toBe(s1.id);
      expect(newConn.sourceAnchor).toBe('right');
      expect(newConn.targetShapeId).toBe(s1.id);
      expect(newConn.targetAnchor).toBe('bottom');
    });

    it('should route orthogonal line entering top anchor from above when source is lower on the left', () => {
      // Shape 1 on the left and lower
      const s1 = component.createShape('rectangle', { x: 100, y: 300 });
      // Shape 2 on the right and higher
      const s2 = component.createShape('rectangle', { x: 400, y: 100 });

      const conn = component.createConnection(s1.id, 'right', s2.id, 'top');
      const rendered = component.renderedConnections().find((c) => c.id === conn.id);

      expect(rendered).toBeDefined();
      const pts = rendered!.points;
      expect(pts.length).toBeGreaterThanOrEqual(4);

      const s2TopAnchor = getShapeAnchorPoint(s2, 'top');
      // The last point must be the top anchor of s2
      const lastPt = pts[pts.length - 1];
      expect(lastPt).toEqual(s2TopAnchor);

      // The second to last point must be directly above the top anchor (pEndStub: y < s2TopAnchor.y)
      const secondToLastPt = pts[pts.length - 2];
      expect(secondToLastPt.x).toBe(s2TopAnchor.x);
      expect(secondToLastPt.y).toBe(s2TopAnchor.y - 20);

      // Verify the final segment enters the top anchor from above (moving downward)
      expect(secondToLastPt.y).toBeLessThan(lastPt.y);
    });

    it('should position connection toolbar below shape when connection midpoint sits below the shape', () => {
      // Shape at (100, 100), width 120, height 80 (bottom at y=180)
      const s1 = component.createShape('rectangle', { x: 100, y: 100 });
      // Create self-loop connection from left to right (looping below the shape)
      const conn = component.createConnection(s1.id, 'left', s1.id, 'right');
      component.selectConnection(conn.id);

      const pos = component.connectionToolbarPos();
      expect(pos).not.toBeNull();
      // Midpoint of self loop left-to-right runs below the shape (y >= 180)
      expect(pos!.placement).toBe('bottom');
      expect(pos!.y).toBeGreaterThan(s1.y + s1.height);
    });

    it('should not show shape anchors simply when a connection is selected', () => {
      const s1 = component.createShape('rectangle', { x: 100, y: 100 });
      const s2 = component.createShape('rectangle', { x: 300, y: 100 });
      const conn = component.createConnection(s1.id, 'right', s2.id, 'left');

      // Clear shape selection and select the connection
      component.clearSelection();
      component.selectConnection(conn.id);
      expect(component.selectedConnectionIds().size).toBe(1);
      expect(component.selectedShapeIds().size).toBe(0);

      fixture.detectChanges();

      // Check canvas-shape component instances in fixture
      const shapeElements = fixture.nativeElement.querySelectorAll('app-canvas-shape');
      expect(shapeElements.length).toBe(2);

      // Verify showAnchors input on the child component is false
      const shapeDebugEls = fixture.debugElement.queryAll((de) => de.name === 'app-canvas-shape');
      for (const de of shapeDebugEls) {
        expect(de.componentInstance.showAnchors()).toBe(false);
      }
    });
  });
});
