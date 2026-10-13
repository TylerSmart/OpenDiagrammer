import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FramesNavigatorComponent } from './frames-navigator.component';
import { CanvasShape, FRAME_PRESETS } from '../canvas/shape.models';

describe('FramesNavigatorComponent', () => {
  let component: FramesNavigatorComponent;
  let fixture: ComponentFixture<FramesNavigatorComponent>;

  const mockFrames: CanvasShape[] = [
    {
      id: 'frame-1',
      type: 'frame',
      x: 100,
      y: 100,
      width: 800,
      height: 600,
      fillColor: 'transparent',
      strokeColor: '#ccc',
      strokeWidth: 2,
      text: 'Overview Slide',
      zIndex: 0,
    },
    {
      id: 'frame-2',
      type: 'frame',
      x: 1000,
      y: 100,
      width: 1920,
      height: 1080,
      fillColor: 'transparent',
      strokeColor: '#ccc',
      strokeWidth: 2,
      text: 'Architecture Details',
      zIndex: 0,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FramesNavigatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FramesNavigatorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('frames', mockFrames);
    fixture.detectChanges();
  });

  it('should create the frames navigator component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the list of frames with their titles and dimensions', () => {
    const rows = fixture.nativeElement.querySelectorAll('.frame-item-row');
    expect(rows.length).toBe(2);

    const firstRowText = rows[0].textContent;
    expect(firstRowText).toContain('Overview Slide');
    expect(firstRowText).toContain('800 × 600');

    const secondRowText = rows[1].textContent;
    expect(secondRowText).toContain('Architecture Details');
    expect(secondRowText).toContain('1920 × 1080');
  });

  it('should emit frameSelect when a frame is clicked', () => {
    let selectedFrame: CanvasShape | undefined;
    component.frameSelect.subscribe((frame) => (selectedFrame = frame));

    const rows = fixture.nativeElement.querySelectorAll('.frame-item-row');
    rows[1].click();

    expect(selectedFrame?.id).toBe('frame-2');
  });

  it('should emit frameAdd when a preset is chosen', () => {
    let addedPreset = null;
    component.frameAdd.subscribe((p) => (addedPreset = p));

    component.handleAdd(FRAME_PRESETS[1]);
    expect(addedPreset).toEqual(FRAME_PRESETS[1]);
  });

  it('should emit frameRename when renaming is committed', () => {
    let renameResult: { id: string; title: string } | undefined;
    component.frameRename.subscribe((res) => (renameResult = res));

    component.startRenaming(mockFrames[0]);
    expect(component.editingFrameId()).toBe('frame-1');

    component.editingTitle.set('Updated Slide Title');
    component.commitRenaming(mockFrames[0]);

    expect(renameResult).toEqual({
      id: 'frame-1',
      title: 'Updated Slide Title',
    });
    expect(component.editingFrameId()).toBeNull();
  });

  it('should emit frameDelete when delete is invoked', () => {
    let deletedId: string | undefined;
    component.frameDelete.subscribe((id) => (deletedId = id));

    const event = new MouseEvent('click');
    component.handleDelete(event, 'frame-1');

    expect(deletedId).toBe('frame-1');
  });

  it('should emit frameReorder when moving up or down', () => {
    const reorderResults: { frameId: string; direction: 'up' | 'down' }[] = [];
    component.frameReorder.subscribe((r) => reorderResults.push(r));

    const event = new MouseEvent('click');
    component.handleMove(event, 'frame-2', 'up');
    component.handleMove(event, 'frame-1', 'down');

    expect(reorderResults).toEqual([
      { frameId: 'frame-2', direction: 'up' },
      { frameId: 'frame-1', direction: 'down' },
    ]);
  });

  it('should navigate through slides with next and prev stepper buttons', () => {
    const selectedFrames: CanvasShape[] = [];
    component.frameSelect.subscribe((f) => selectedFrames.push(f));

    fixture.componentRef.setInput('activeFrameId', 'frame-1');
    fixture.detectChanges();

    component.handleNext();
    expect(selectedFrames.length).toBe(1);
    expect(selectedFrames[0].id).toBe('frame-2');

    fixture.componentRef.setInput('activeFrameId', 'frame-2');
    fixture.detectChanges();

    component.handlePrev();
    expect(selectedFrames.length).toBe(2);
    expect(selectedFrames[1].id).toBe('frame-1');
  });

  it('should show empty state when frames list is empty', () => {
    fixture.componentRef.setInput('frames', []);
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No Frames Yet');
  });

  it('should emit closeNavigator and present when respective buttons are clicked', () => {
    let closed = false;
    let presented = false;
    component.closeNavigator.subscribe(() => (closed = true));
    component.present.subscribe(() => (presented = true));

    const closeBtn = fixture.nativeElement.querySelector('.close-btn');
    closeBtn.click();
    expect(closed).toBe(true);

    const presentBtn = fixture.nativeElement.querySelector('.present-btn');
    presentBtn.click();
    expect(presented).toBe(true);
  });
});
