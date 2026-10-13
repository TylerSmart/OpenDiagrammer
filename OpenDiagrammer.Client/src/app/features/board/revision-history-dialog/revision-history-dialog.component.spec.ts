import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  BoardDetailDto,
  BoardRole,
  BoardRevisionSummaryDto,
} from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';
import {
  RevisionHistoryDialogComponent,
  RevisionHistoryDialogData,
} from './revision-history-dialog.component';

describe('RevisionHistoryDialogComponent', () => {
  let component: RevisionHistoryDialogComponent;
  let fixture: ComponentFixture<RevisionHistoryDialogComponent>;

  const mockRevisions: BoardRevisionSummaryDto[] = [
    {
      id: 'rev-1',
      boardId: 'b-123',
      title: 'V1 Initial',
      description: 'First draft',
      createdById: 'u-1',
      createdByUsername: 'alice',
      createdAt: '2026-10-12T10:00:00Z',
    },
  ];

  const dialogData: RevisionHistoryDialogData = {
    boardId: 'b-123',
    userRole: BoardRole.Owner,
  };

  let mockBoardService: {
    getRevisions: ReturnType<typeof vi.fn>;
    createRevision: ReturnType<typeof vi.fn>;
    restoreRevision: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBoardService = {
      getRevisions: vi.fn().mockReturnValue(of(mockRevisions)),
      createRevision: vi.fn().mockReturnValue(
        of({
          id: 'rev-2',
          boardId: 'b-123',
          title: 'V2 Snapshot',
          description: null,
          createdById: 'u-1',
          createdByUsername: 'alice',
          createdAt: '2026-10-12T11:00:00Z',
        }),
      ),
      restoreRevision: vi.fn().mockReturnValue(
        of({
          id: 'b-123',
          name: 'Restored Board',
        } as BoardDetailDto),
      ),
    };
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RevisionHistoryDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: BoardService, useValue: mockBoardService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RevisionHistoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load revisions on init', () => {
    expect(component).toBeTruthy();
    expect(mockBoardService.getRevisions).toHaveBeenCalledWith('b-123');
    expect(component.revisions().length).toBe(1);
    expect(component.revisions()[0].title).toBe('V1 Initial');
  });

  it('should create a snapshot and add to revisions list', () => {
    component.form.setValue({
      title: 'V2 Snapshot',
      description: null,
    });

    component.handleCreateSnapshot();

    expect(mockBoardService.createRevision).toHaveBeenCalledWith('b-123', {
      title: 'V2 Snapshot',
      description: null,
    });
    expect(component.revisions().length).toBe(2);
    expect(mockSnackBar.open).toHaveBeenCalledWith('Snapshot "V2 Snapshot" created.', undefined, {
      duration: 2500,
    });
  });

  it('should restore a snapshot and close dialog with restored board', () => {
    const targetRev = mockRevisions[0];
    component.handleRestore(targetRev);

    expect(mockBoardService.restoreRevision).toHaveBeenCalledWith('b-123', 'rev-1');
    expect(mockDialogRef.close).toHaveBeenCalledWith({
      restoredBoard: expect.objectContaining({ id: 'b-123' }),
    });
  });

  it('should close dialog when cancel/close is clicked', () => {
    component.handleClose();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
