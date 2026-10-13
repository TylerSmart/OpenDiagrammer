import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanvasShapeComponent } from './canvas-shape.component';
import { CanvasShape } from '../shape.models';

describe('CanvasShapeComponent', () => {
  let component: CanvasShapeComponent;
  let fixture: ComponentFixture<CanvasShapeComponent>;

  const mockShape: CanvasShape = {
    id: 'shape-1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#333333',
    strokeWidth: 2,
    zIndex: 1,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasShapeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CanvasShapeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('shape', mockShape);
    fixture.detectChanges();
  });

  it('should create canvas shape component', () => {
    expect(component).toBeTruthy();
  });

  it('should not show anchors when not hovered and not selected', () => {
    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(0);
  });

  it('should show anchors when hovered and not selected', () => {
    component.isHovered.set(true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(4);
  });

  it('should show anchors when shape is selected and hovered (coexisting with resize handles)', () => {
    fixture.componentRef.setInput('isSelected', true);
    component.isHovered.set(true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(4);
  });

  it('should show anchors when showAnchors is true even if selected', () => {
    fixture.componentRef.setInput('isSelected', true);
    fixture.componentRef.setInput('showAnchors', true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(4);
  });

  it('should not show anchors on hover when allowHoverAnchors is false', () => {
    fixture.componentRef.setInput('allowHoverAnchors', false);
    component.isHovered.set(true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(0);
  });

  it('should render rich text HTML safely inside overlay', () => {
    fixture.componentRef.setInput('shape', {
      ...mockShape,
      text: '<b>Hello</b> <i>World</i><script>alert(1)</script>',
      textAlign: 'left',
      isBold: true,
    });
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.shape-text-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.innerHTML).toContain('<b>Hello</b>');
    expect(overlay.innerHTML).toContain('<i>World</i>');
    expect(overlay.innerHTML).not.toContain('<script>');
  });

  it('should emit shapeDoubleClick on double click', () => {
    let emittedShape: CanvasShape | null = null;
    component.shapeDoubleClick.subscribe((s) => {
      emittedShape = s;
    });

    const container = fixture.nativeElement.querySelector('.shape-container');
    container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(emittedShape).toEqual(mockShape);
  });

  it('should render flowchart shapes correctly', () => {
    // Flowchart terminal
    fixture.componentRef.setInput('shape', {
      ...mockShape,
      type: 'flowchart-terminal',
    });
    fixture.detectChanges();
    const terminalRect = fixture.nativeElement.querySelector('rect[rx]');
    expect(terminalRect).toBeTruthy();

    // Flowchart database
    fixture.componentRef.setInput('shape', {
      ...mockShape,
      type: 'flowchart-database',
    });
    fixture.detectChanges();
    const dbPath = fixture.nativeElement.querySelector('path');
    const dbEllipse = fixture.nativeElement.querySelector('ellipse');
    expect(dbPath).toBeTruthy();
    expect(dbEllipse).toBeTruthy();
  });

  it('should render UML shapes correctly', () => {
    // UML class
    fixture.componentRef.setInput('shape', {
      ...mockShape,
      type: 'uml-class',
    });
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('line');
    expect(lines.length).toBe(2);

    // UML actor
    fixture.componentRef.setInput('shape', {
      ...mockShape,
      type: 'uml-actor',
    });
    fixture.detectChanges();
    const actorCircle = fixture.nativeElement.querySelector('circle');
    const actorLines = fixture.nativeElement.querySelectorAll('line');
    expect(actorCircle).toBeTruthy();
    expect(actorLines.length).toBe(4);
  });
});
