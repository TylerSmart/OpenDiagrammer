import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
import { CrdtService } from '../../core/services/crdt/crdt.service';
import { BoardRealtimeService } from '../../core/services/realtime/board-realtime.service';
import { NetworkStatusService } from '../../core/services/network/network-status.service';
import { BoardViewComponent } from './board-view.component';
import { CanvasDiagramData } from './canvas/canvas.models';

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
    canvasDataJson: null,
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
    updateCanvasData: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof vi.fn>;
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
      updateCanvasData: vi.fn().mockReturnValue(of({ ...mockBoardDetail })),
    };
    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-1',
        email: 'architect@example.com',
        username: 'architect',
      }),
      token: vi.fn().mockReturnValue('mock-jwt-token'),
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

    const mockCrdtService = {
      initBoard: vi.fn().mockResolvedValue(undefined),
      applyLocalDiagramChange: vi.fn(),
      applyRemoteUpdate: vi.fn(),
      localUpdate$: of(),
      diagramData: signal({ shapes: [], connections: [] }),
      destroy: vi.fn(),
    };
    const mockRealtimeService = {
      startConnection: vi.fn().mockResolvedValue({ presences: [], crdtState: null }),
      stopConnection: vi.fn().mockResolvedValue(undefined),
      sendCrdtUpdate: vi.fn().mockResolvedValue(undefined),
      sendCursor: vi.fn().mockResolvedValue(undefined),
      presences: signal([]),
      otherUsersCursors: signal({}),
      connectionState: signal('connected'),
    };
    const mockNetworkStatusService = {
      isOnline: signal(true),
      status: signal('online'),
    };

    await TestBed.configureTestingModule({
      imports: [BoardViewComponent],
      providers: [
        { provide: BoardService, useValue: mockBoardService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: CrdtService, useValue: mockCrdtService },
        { provide: BoardRealtimeService, useValue: mockRealtimeService },
        { provide: NetworkStatusService, useValue: mockNetworkStatusService },
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize isBoardEmpty based on canvasDataJson', () => {
    // When board has shapes
    mockBoardService.getBoardById.mockReturnValue(
      of({
        ...mockBoardDetail,
        canvasDataJson: JSON.stringify({
          shapes: [
            {
              id: 's1',
              type: 'rectangle',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              strokeColor: '#000',
              fillColor: '#fff',
              strokeWidth: 2,
              zIndex: 1,
            },
          ],
          connections: [],
        }),
      }),
    );
    component.loadBoard('test-board-id');
    expect(component['isBoardEmpty']()).toBe(false);

    // When board has empty shapes
    mockBoardService.getBoardById.mockReturnValue(
      of({
        ...mockBoardDetail,
        canvasDataJson: JSON.stringify({ shapes: [], connections: [] }),
      }),
    );
    component.loadBoard('test-board-id');
    expect(component['isBoardEmpty']()).toBe(true);
  });

  it('should debounce and persist diagram changes via boardService.updateCanvasData', () => {
    vi.useFakeTimers();
    const diagramData: CanvasDiagramData = {
      shapes: [
        {
          id: 's1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 100,
          height: 100,
          strokeColor: '#000',
          fillColor: '#fff',
          strokeWidth: 2,
          zIndex: 1,
        },
      ],
      connections: [],
      zoom: 1.5,
      panX: 50,
      panY: 60,
    };

    component.handleDiagramChange(diagramData);
    expect(component['saveStatus']()).toBe('saving');
    expect(component['isBoardEmpty']()).toBe(false);
    expect(mockBoardService.updateCanvasData).not.toHaveBeenCalled();

    // Advance by debounce time
    vi.advanceTimersByTime(500);

    expect(mockBoardService.updateCanvasData).toHaveBeenCalledWith('test-board-id', {
      canvasDataJson: JSON.stringify(diagramData),
    });
    expect(component['saveStatus']()).toBe('saved');
    expect(component['board']()?.canvasDataJson).toBe(JSON.stringify(diagramData));
  });

  it('should not persist diagram changes if user role is Viewer', () => {
    vi.useFakeTimers();
    component['board'].set({
      ...mockBoardDetail,
      userRole: BoardRole.Viewer,
    });

    const diagramData: CanvasDiagramData = {
      shapes: [],
      connections: [],
    };

    component.handleDiagramChange(diagramData);
    vi.advanceTimersByTime(500);

    expect(mockBoardService.updateCanvasData).not.toHaveBeenCalled();
  });

  it('should set saveStatus to error and show snackbar when updateCanvasData fails', () => {
    vi.useFakeTimers();
    mockBoardService.updateCanvasData.mockReturnValue(throwError(() => new Error('Save error')));

    const diagramData: CanvasDiagramData = {
      shapes: [
        {
          id: 's1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 100,
          height: 100,
          strokeColor: '#000',
          fillColor: '#fff',
          strokeWidth: 2,
          zIndex: 1,
        },
      ],
      connections: [],
    };

    component.handleDiagramChange(diagramData);
    vi.advanceTimersByTime(500);

    expect(component['saveStatus']()).toBe('error');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Failed to save diagram changes.',
      'Dismiss',
      expect.objectContaining({ duration: 4000 }),
    );
  });

  it('should flush pending diagram changes immediately using fetch with keepalive', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const diagramData: CanvasDiagramData = {
      shapes: [
        {
          id: 's1',
          type: 'rectangle',
          x: 10,
          y: 20,
          width: 100,
          height: 100,
          strokeColor: '#000',
          fillColor: '#fff',
          strokeWidth: 2,
          zIndex: 1,
        },
      ],
      connections: [],
    };

    component.handleDiagramChange(diagramData);
    component.flushPendingSave();

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/boards/test-board-id/canvas',
      expect.objectContaining({
        method: 'PUT',
        keepalive: true,
      }),
    );
  });

  it('should toggle showLiveCursors when toggleLiveCursors is called', () => {
    expect(component['showLiveCursors']()).toBe(true);
    component.toggleLiveCursors();
    expect(component['showLiveCursors']()).toBe(false);
    component.toggleLiveCursors();
    expect(component['showLiveCursors']()).toBe(true);
  });

  it('should forward cursor position to realtimeService on handleCursorMove', () => {
    const realtimeService = TestBed.inject(BoardRealtimeService) as unknown as {
      sendCursor: ReturnType<typeof vi.fn>;
    };
    component.handleCursorMove({ x: 150, y: 250 });
    expect(realtimeService.sendCursor).toHaveBeenCalledWith(150, 250);
  });

  it('should load board from localStorage cache when backend fails', () => {
    mockBoardService.getBoardById.mockReturnValue(throwError(() => ({ status: 0 })));
    localStorage.setItem(
      'board_cache_offline-id',
      JSON.stringify({
        ...mockBoardDetail,
        id: 'offline-id',
        name: 'Offline Cached Board',
      }),
    );

    component.loadBoard('offline-id');

    expect(component['board']()?.name).toBe('Offline Cached Board');
    expect(component['errorMessage']()).toBeNull();

    localStorage.removeItem('board_cache_offline-id');
  });
});
