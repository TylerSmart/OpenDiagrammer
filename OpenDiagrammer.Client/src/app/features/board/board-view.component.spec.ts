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
    updateBoard: ReturnType<typeof vi.fn>;
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
      updateBoard: vi.fn().mockReturnValue(of({ ...mockBoardDetail })),
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
      remoteDiagramData$: of(),
      diagramData: signal({ shapes: [], connections: [] }),
      destroy: vi.fn(),
    };
    const mockRealtimeService = {
      startConnection: vi.fn().mockResolvedValue({ presences: [], crdtState: null }),
      stopConnection: vi.fn().mockResolvedValue(undefined),
      sendCrdtUpdate: vi.fn().mockResolvedValue(undefined),
      sendCursor: vi.fn().mockResolvedValue(undefined),
      sendBoardModeUpdate: vi.fn().mockResolvedValue(undefined),
      boardModeUpdate: signal(null),
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

  it('should place a shape on canvas when tool is selected and canvas is clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const canvas = component['canvasComponent']();
    expect(canvas).toBeTruthy();

    // Select rectangle tool
    canvas!.setActiveTool('rectangle');
    expect(canvas!.activeTool()).toBe('rectangle');

    // Click canvas
    const canvasViewport = fixture.nativeElement.querySelector('.canvas-viewport-area');
    expect(canvasViewport).toBeTruthy();

    canvasViewport.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 400,
        clientY: 300,
        button: 0,
      }),
    );
    fixture.detectChanges();

    expect(canvas!.shapes().length).toBe(1);
  });

  describe('Think Mode', () => {
    it('should switch to Think Mode and update board mode via setBoardMode', () => {
      fixture.detectChanges();
      const configJson = JSON.stringify({
        timerSeconds: 300,
        viewerParticipation: true,
        hideOthersWriting: true,
      });

      component.setBoardMode(BoardMode.ThinkMode, configJson);

      expect(component['board']()?.mode).toBe(BoardMode.ThinkMode);
      expect(component['thinkModeConfig']()?.timerSeconds).toBe(300);
      expect(component['thinkModeConfig']()?.viewerParticipation).toBe(true);
      expect(component['thinkModeConfig']()?.hideOthersWriting).toBe(true);
      expect(mockBoardService.updateBoard).toHaveBeenCalled();
    });

    it('should end Think Mode and reset to normal mode', () => {
      fixture.detectChanges();
      component.setBoardMode(BoardMode.ThinkMode, JSON.stringify({ timerSeconds: 120 }));
      expect(component['board']()?.mode).toBe(BoardMode.ThinkMode);

      component.endThinkMode();

      expect(component['board']()?.mode).toBe(BoardMode.Normal);
      expect(component['board']()?.thinkModeConfigJson).toBeNull();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Think Mode ended. Board returned to normal mode.',
        'Close',
        expect.any(Object),
      );
    });

    it('should format timer string correctly based on timerSecondsRemaining', () => {
      component['timerSecondsRemaining'].set(275); // 4 mins 35 secs
      expect(component['timerFormatted']()).toBe('04:35');

      component['timerSecondsRemaining'].set(59); // 0 mins 59 secs
      expect(component['timerFormatted']()).toBe('00:59');

      component['timerSecondsRemaining'].set(null);
      expect(component['timerFormatted']()).toBe('--:--');
    });

    it('should toggle facilitator reveal notes', () => {
      expect(component['facilitatorRevealNotes']()).toBe(false);
      component.toggleFacilitatorReveal();
      expect(component['facilitatorRevealNotes']()).toBe(true);
      component.toggleFacilitatorReveal();
      expect(component['facilitatorRevealNotes']()).toBe(false);
    });

    it('should add time to timer', () => {
      const config = {
        timerSeconds: 300,
        timerEndsAt: new Date(Date.now() + 300000).toISOString(),
        isTimerRunning: true,
      };
      component.setBoardMode(BoardMode.ThinkMode, JSON.stringify(config));

      component.addTimeToTimer(60);

      const updated = component['thinkModeConfig']();
      expect(updated?.timerSeconds).toBe(360);
      expect(updated?.isTimerRunning).toBe(true);
    });
  });

  describe('Frames and Pages', () => {
    it('should toggle frames navigator panel open and closed', () => {
      expect(component['isFramesNavigatorOpen']()).toBe(false);
      component.toggleFramesNavigator();
      expect(component['isFramesNavigatorOpen']()).toBe(true);
      component.toggleFramesNavigator();
      expect(component['isFramesNavigatorOpen']()).toBe(false);
    });

    it('should handle frame addition, selection, renaming, and deletion', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const canvas = component['canvasComponent']();
      expect(canvas).toBeTruthy();

      // Add a frame
      component.handleFrameAdd({
        id: 'presentation-16-9',
        name: 'Presentation (16:9)',
        width: 1920,
        height: 1080,
        icon: 'slideshow',
      });

      expect(component['framesList']().length).toBe(1);
      const addedFrame = component['framesList']()[0];
      expect(addedFrame.type).toBe('frame');
      expect(component['activeFrameId']()).toBe(addedFrame.id);

      // Rename frame
      component.handleFrameRename({
        id: addedFrame.id,
        title: 'Renamed Frame Title',
      });
      const renamedFrame = component['framesList']()[0];
      expect(renamedFrame.text).toBe('Renamed Frame Title');

      // Select frame
      component.handleFrameSelect(renamedFrame);
      expect(component['activeFrameId']()).toBe(renamedFrame.id);

      // Delete frame
      component.handleFrameDelete(renamedFrame.id);
      expect(component['framesList']().length).toBe(0);
      expect(component['activeFrameId']()).toBeNull();
    });

    it('should trigger fullscreen presentation when handlePresent is called', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const toggleSpy = vi.spyOn(component['fullscreenService'], 'toggleFullscreen');

      component.handleFrameAdd({
        id: 'custom',
        name: 'Custom Frame',
        width: 800,
        height: 600,
        icon: 'crop_free',
      });

      component.handlePresent();
      expect(toggleSpy).toHaveBeenCalled();
    });

    it('should open export dialog when openExportDialog is called', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.openExportDialog();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          width: '560px',
          data: expect.objectContaining({
            boardName: 'Architecture Plan',
          }),
        }),
      );
    });
  });
});
