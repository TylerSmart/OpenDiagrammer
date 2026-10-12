import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { BoardMemberDto, BoardRole } from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';
import {
  BoardMembersDialogComponent,
  BoardMembersDialogData,
} from './board-members-dialog.component';

describe('BoardMembersDialogComponent', () => {
  let component: BoardMembersDialogComponent;
  let fixture: ComponentFixture<BoardMembersDialogComponent>;

  const mockMembers: BoardMemberDto[] = [
    {
      id: 'm-1',
      boardId: 'b-members-id',
      userId: 'u-owner',
      username: 'owner',
      email: 'owner@example.com',
      role: BoardRole.Owner,
      createdAt: '2026-10-10T00:00:00Z',
    },
    {
      id: 'm-2',
      boardId: 'b-members-id',
      userId: 'u-member',
      username: 'collaborator',
      email: 'collab@example.com',
      role: BoardRole.Editor,
      createdAt: '2026-10-10T00:00:00Z',
    },
  ];

  const dialogData: BoardMembersDialogData = {
    boardId: 'b-members-id',
    currentUserRole: BoardRole.Owner,
    currentUserId: 'u-owner',
  };

  let mockBoardService: {
    getMembers: ReturnType<typeof vi.fn>;
    addMember: ReturnType<typeof vi.fn>;
    updateMemberRole: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockBoardService = {
      getMembers: vi.fn().mockReturnValue(of(mockMembers)),
      addMember: vi.fn().mockReturnValue(
        of({
          id: 'm-3',
          boardId: 'b-members-id',
          userId: 'u-new',
          username: 'newmember',
          email: 'new@example.com',
          role: BoardRole.Viewer,
          createdAt: '2026-10-10T00:00:00Z',
        }),
      ),
      updateMemberRole: vi.fn().mockReturnValue(
        of({
          id: 'm-2',
          boardId: 'b-members-id',
          userId: 'u-member',
          username: 'collaborator',
          email: 'collab@example.com',
          role: BoardRole.Admin,
          createdAt: '2026-10-10T00:00:00Z',
        }),
      ),
      removeMember: vi.fn().mockReturnValue(of(undefined)),
    };
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BoardMembersDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: BoardService, useValue: mockBoardService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardMembersDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load board members on init', () => {
    expect(component).toBeTruthy();
    expect(mockBoardService.getMembers).toHaveBeenCalledWith('b-members-id');
    expect(component['members']().length).toBe(2);
  });

  it('should add new member and append to members signal', () => {
    component['addMemberForm'].patchValue({
      emailOrUsername: 'new@example.com',
      role: BoardRole.Viewer,
    });

    component.onAddMember();
    expect(mockBoardService.addMember).toHaveBeenCalledWith('b-members-id', {
      emailOrUsername: 'new@example.com',
      role: BoardRole.Viewer,
    });
    expect(component['members']().length).toBe(3);
    expect(component['hasChanges']()).toBe(true);
  });

  it('should update member role', () => {
    component.onChangeRole(mockMembers[1], BoardRole.Admin);
    expect(mockBoardService.updateMemberRole).toHaveBeenCalledWith('b-members-id', 'u-member', {
      role: BoardRole.Admin,
    });
    expect(component['hasChanges']()).toBe(true);
  });

  it('should remove member after confirmation', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.onRemoveMember(mockMembers[1]);
    expect(mockBoardService.removeMember).toHaveBeenCalledWith('b-members-id', 'u-member');
    expect(component['members']().length).toBe(1);
    expect(component['hasChanges']()).toBe(true);
  });
});
