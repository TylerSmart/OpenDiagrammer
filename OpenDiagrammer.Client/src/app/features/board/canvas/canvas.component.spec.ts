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
});
