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

  it('should NEVER show anchors when shape is selected (resize handles precedence)', () => {
    fixture.componentRef.setInput('isSelected', true);
    component.isHovered.set(true);
    fixture.componentRef.setInput('showAnchors', true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(0);
  });

  it('should show anchors when showAnchors is true and not selected', () => {
    fixture.componentRef.setInput('isSelected', false);
    fixture.componentRef.setInput('showAnchors', true);
    fixture.detectChanges();

    const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
    expect(anchors.length).toBe(4);
  });
});
