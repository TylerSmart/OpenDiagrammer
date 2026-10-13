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
      text: 'OrderService\n---\n+ id: string\n---\n+ checkout()',
    });
    fixture.detectChanges();
    const compartments = fixture.nativeElement.querySelectorAll('.uml-compartment');
    expect(compartments.length).toBe(3);
    expect(fixture.nativeElement.querySelector('.uml-header')?.textContent).toContain(
      'OrderService',
    );
    expect(fixture.nativeElement.querySelector('.uml-attributes')?.textContent).toContain(
      '+ id: string',
    );
    expect(fixture.nativeElement.querySelector('.uml-methods')?.textContent).toContain(
      '+ checkout()',
    );

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

  describe('Sticky Notes', () => {
    it('should render sticky note rect', () => {
      fixture.componentRef.setInput('shape', {
        ...mockShape,
        type: 'sticky-note',
      });
      fixture.detectChanges();
      const stickyRect = fixture.nativeElement.querySelector('rect[rx="4"]');
      expect(stickyRect).toBeTruthy();
    });

    it('should display author badge when authorName is provided and showAuthor is not false', () => {
      fixture.componentRef.setInput('shape', {
        ...mockShape,
        type: 'sticky-note',
        authorName: 'Alice',
      });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.sticky-author-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Alice');
    });

    it('should hide author badge when showAuthor is false', () => {
      fixture.componentRef.setInput('shape', {
        ...mockShape,
        type: 'sticky-note',
        authorName: 'Alice',
        showAuthor: false,
      });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.sticky-author-badge');
      expect(badge).toBeFalsy();
    });

    it('should show masked overlay and hide text and author when isMasked is true', () => {
      fixture.componentRef.setInput('shape', {
        ...mockShape,
        type: 'sticky-note',
        text: 'Secret Idea',
        authorName: 'Alice',
      });
      fixture.componentRef.setInput('isMasked', true);
      fixture.detectChanges();

      const maskedOverlay = fixture.nativeElement.querySelector('.shape-masked-overlay');
      expect(maskedOverlay).toBeTruthy();
      expect(maskedOverlay.textContent).toContain('••••••');

      const textOverlay = fixture.nativeElement.querySelector('.shape-text-overlay');
      expect(textOverlay).toBeFalsy();

      const authorBadge = fixture.nativeElement.querySelector('.sticky-author-badge');
      expect(authorBadge).toBeFalsy();
    });

    it('should render sticky pad and emit pullStickyNote on button click', () => {
      const padShape: CanvasShape = {
        ...mockShape,
        type: 'sticky-pad',
      };
      fixture.componentRef.setInput('shape', padShape);
      fixture.detectChanges();

      let pulledShape: CanvasShape | null = null;
      component.pullStickyNote.subscribe((s) => {
        pulledShape = s;
      });

      const pullBtn = fixture.nativeElement.querySelector('.sticky-pad-pull-button');
      expect(pullBtn).toBeTruthy();

      pullBtn.click();
      expect(pulledShape).toEqual(padShape);
    });

    it('should render frame with header tab, title, and size badge, and without anchors or center text overlay', () => {
      const frameShape: CanvasShape = {
        ...mockShape,
        type: 'frame',
        width: 1920,
        height: 1080,
        text: 'Presentation Slide 1',
      };
      fixture.componentRef.setInput('shape', frameShape);
      component.isHovered.set(true);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.shape-container');
      expect(container.classList).toContain('is-frame');

      const headerTab = fixture.nativeElement.querySelector('.frame-header-tab');
      expect(headerTab).toBeTruthy();
      expect(headerTab.textContent).toContain('Presentation Slide 1');
      expect(headerTab.textContent).toContain('1920 × 1080');

      // Center text overlay should be omitted for frames
      const textOverlay = fixture.nativeElement.querySelector('.shape-text-overlay');
      expect(textOverlay).toBeFalsy();

      // Anchors should be omitted for frames
      const anchors = fixture.nativeElement.querySelectorAll('.shape-anchor');
      expect(anchors.length).toBe(0);
    });
  });
});
