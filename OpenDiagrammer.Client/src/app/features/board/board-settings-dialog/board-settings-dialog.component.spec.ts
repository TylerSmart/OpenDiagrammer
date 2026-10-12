import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  BoardBackgroundType,
  BoardMode,
  BoardRole,
  BoardDetailDto,
} from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';
import {
  BoardSettingsDialogComponent,
  BoardSettingsDialogData,
} from './board-settings-dialog.component';

describe('BoardSettingsDialogComponent', () => {
  let component: BoardSettingsDialogComponent;
  let fixture: ComponentFixture<BoardSettingsDialogComponent>;

  const mockBoard: BoardDetailDto = {
    id: 'b-settings-id',
    name: 'Settings Test Board',
    description: 'Initial description',
    ownerId: 'u-owner',
    ownerUsername: 'owneruser',
    userRole: BoardRole.Owner,
    backgroundType: BoardBackgroundType.GridLines,
    backgroundColor: '#ffffff',
    backgroundOpacity: 1,
    mode: BoardMode.Normal,
    thinkModeConfigJson: null,
    createdAt: '2026-10-10T00:00:00Z',
    modifiedAt: '2026-10-10T00:00:00Z',
    members: [],
  };

  const dialogData: BoardSettingsDialogData = {
    board: mockBoard,
    isOwner: true,
    isAdmin: true,
  };

  let mockBoardService: {
    updateBoard: ReturnType<typeof vi.fn>;
    transferOwnership: ReturnType<typeof vi.fn>;
    deleteBoard: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBoardService = {
      updateBoard: vi.fn().mockReturnValue(of({ ...mockBoard, name: 'Updated Name' })),
      transferOwnership: vi.fn().mockReturnValue(of({ message: 'Success' })),
      deleteBoard: vi.fn().mockReturnValue(of(undefined)),
    };
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BoardSettingsDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: BoardService, useValue: mockBoardService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardSettingsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize form with existing board data', () => {
    expect(component).toBeTruthy();
    expect(component['form'].controls.name.value).toBe('Settings Test Board');
    expect(component['form'].controls.description.value).toBe('Initial description');
  });

  it('should save board settings updates and close dialog', () => {
    component['form'].controls.name.setValue('Updated Name');
    component.onSave();

    expect(mockBoardService.updateBoard).toHaveBeenCalledWith(
      'b-settings-id',
      expect.objectContaining({ name: 'Updated Name' }),
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      action: 'updated',
      board: expect.objectContaining({ name: 'Updated Name' }),
    });
  });

  it('should validate and transfer ownership', () => {
    const validGuid = '11111111-2222-3333-4444-555555555555';
    component['newOwnerIdControl'].setValue(validGuid);
    expect(component['newOwnerIdControl'].valid).toBe(true);

    component.onTransferOwnership();
    expect(mockBoardService.transferOwnership).toHaveBeenCalledWith('b-settings-id', {
      newOwnerId: validGuid,
    });
    expect(mockDialogRef.close).toHaveBeenCalledWith({ action: 'transferred' });
  });

  it('should open confirmation dialog and delete board', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.onDeleteBoard();
    expect(mockBoardService.deleteBoard).toHaveBeenCalledWith('b-settings-id');
    expect(mockDialogRef.close).toHaveBeenCalledWith({ action: 'deleted' });
  });
});
