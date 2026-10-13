import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { BoardBackgroundType } from '../../../core/models/board.models';
import { CreateBoardDialogComponent } from './create-board-dialog.component';

describe('CreateBoardDialogComponent', () => {
  let component: CreateBoardDialogComponent;
  let fixture: ComponentFixture<CreateBoardDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CreateBoardDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: mockDialogRef }],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateBoardDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the dialog component', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form initially when name is empty', () => {
    expect(component['form'].valid).toBe(false);
  });

  it('should submit valid form and close with request payload', () => {
    component['form'].patchValue({
      name: 'Sprint Retro',
      description: 'End of sprint reflection',
      backgroundType: BoardBackgroundType.GridDots,
    });

    expect(component['form'].valid).toBe(true);
    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith({
      name: 'Sprint Retro',
      description: 'End of sprint reflection',
      backgroundType: BoardBackgroundType.GridDots,
      backgroundColor: null,
      backgroundOpacity: 1.0,
    });
  });

  it('should not close when submitting invalid form', () => {
    component['form'].patchValue({ name: '' });
    component.onSubmit();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });
});
