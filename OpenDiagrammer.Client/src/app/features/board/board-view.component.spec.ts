import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  BoardBackgroundType,
  BoardMode,
  BoardRole,
  BoardDetailDto,
} from '../../core/models/board.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { BoardService } from '../../core/services/board/board.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { FullscreenService } from '../../core/services/fullscreen/fullscreen.service';
import { BoardViewComponent } from './board-view.component';

describe('BoardViewComponent', () => {
  let component: BoardViewComponent;
  let fixture: ComponentFixture<BoardViewComponent>;

  const mockBoardDetail: BoardDetailDto = {
    id: 'test-board-id',
    name: 'Architecture Plan',
    description: 'System architectural diagrams',
    ownerId: 'u-1',
    ownerUsername: 'architect',
    userRole: BoardRole.Owner,
    backgroundType: BoardBackgroundType.GridLines,
    backgroundColor: '#f0f0f0',
    backgroundOpacity: 0.9,
    mode: BoardMode.Normal,
    thinkModeConfigJson: null,
    createdAt: '2026-10-10T00:00:00Z',
    modifiedAt: '2026-10-10T00:00:00Z',
    members: [
      {
        id: 'm-1',
        boardId: 'test-board-id',
        userId: 'u-1',
        username: 'architect',
        email: 'architect@example.com',
        role: BoardRole.Owner,
        createdAt: '2026-10-10T00:00:00Z',
      },
    ],
  };

  let mockBoardService: {
    getBoardById: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockBoardService = {
      getBoardById: vi.fn().mockReturnValue(of(mockBoardDetail)),
    };
    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-1',
        email: 'architect@example.com',
        username: 'architect',
      }),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    mockDialog = {
      open: vi.fn(),
    };
    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BoardViewComponent],
      providers: [
        { provide: BoardService, useValue: mockBoardService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'test-board-id' : null),
              },
            },
          },
        },
        ThemeService,
        FullscreenService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load board data from route params', () => {
    expect(component).toBeTruthy();
    expect(mockBoardService.getBoardById).toHaveBeenCalledWith('test-board-id');
    expect(component['board']()?.name).toBe('Architecture Plan');
  });

  it('should navigate back to dashboard when goBack is called', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should set error message when board load fails', () => {
    mockBoardService.getBoardById.mockReturnValue(throwError(() => ({ status: 404 })));

    component.loadBoard('non-existent');
    expect(component['errorMessage']()).toBe('Board not found.');
  });

  it('should toggle fullscreen using FullscreenService', async () => {
    const fullscreenService = TestBed.inject(FullscreenService);
    const toggleSpy = vi.spyOn(fullscreenService, 'toggleFullscreen').mockResolvedValue(undefined);

    const fullscreenBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'button[aria-label="Fullscreen"]',
    );
    expect(fullscreenBtn).toBeTruthy();

    fullscreenBtn?.click();
    expect(toggleSpy).toHaveBeenCalled();
  });
});
