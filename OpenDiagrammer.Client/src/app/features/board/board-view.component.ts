import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import {
  BoardBackgroundType,
  BoardDetailDto,
  BoardMode,
  BoardRole,
  UpdateCanvasDataRequest,
  canManageBoardSettings,
  getRoleName,
} from '../../core/models/board.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { BoardService } from '../../core/services/board/board.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import { FullscreenService } from '../../core/services/fullscreen/fullscreen.service';
import { CrdtService, base64ToUint8Array } from '../../core/services/crdt/crdt.service';
import { BoardRealtimeService } from '../../core/services/realtime/board-realtime.service';
import { NetworkStatusService } from '../../core/services/network/network-status.service';
import { CanvasComponent } from './canvas/canvas.component';
import { CanvasDiagramData, CanvasPoint } from './canvas/canvas.models';
import {
  BoardMembersDialogComponent,
  BoardMembersDialogData,
} from './board-members-dialog/board-members-dialog.component';
import {
  BoardSettingsDialogComponent,
  BoardSettingsDialogData,
  BoardSettingsDialogResult,
} from './board-settings-dialog/board-settings-dialog.component';

const THEME_ICONS: Record<ThemeMode, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'brightness_auto',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    CanvasComponent,
  ],
  selector: 'app-board-view',
  styleUrl: './board-view.component.scss',
  templateUrl: './board-view.component.html',
  host: {
    '(window:beforeunload)': 'flushPendingSave()',
    '(window:pagehide)': 'flushPendingSave()',
  },
})
export class BoardViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly boardService = inject(BoardService);
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly fullscreenService = inject(FullscreenService);
  protected readonly crdtService = inject(CrdtService);
  protected readonly realtimeService = inject(BoardRealtimeService);
  protected readonly networkStatusService = inject(NetworkStatusService);
  protected readonly canvasComponent = viewChild(CanvasComponent);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly saveTrigger$ = new Subject<CanvasDiagramData>();
  private pendingDiagramData: CanvasDiagramData | null = null;

  protected readonly board = signal<BoardDetailDto | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isBoardEmpty = signal<boolean>(true);
  protected readonly saveStatus = signal<'saved' | 'saving' | 'error'>('saved');

  protected readonly showLiveCursors = signal<boolean>(true);
  protected readonly activePresences = computed(() => this.realtimeService.presences());
  protected readonly liveCursorsList = computed(() =>
    Object.values(this.realtimeService.otherUsersCursors()),
  );
  protected readonly networkStatus = computed(() => this.networkStatusService.status());

  protected readonly BoardBackgroundType = BoardBackgroundType;
  protected readonly BoardMode = BoardMode;
  protected readonly BoardRole = BoardRole;
  protected readonly getRoleName = getRoleName;
  protected readonly canManageSettings = canManageBoardSettings;

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  constructor() {
    this.crdtService.localUpdate$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((update) => {
      void this.realtimeService.sendCrdtUpdate(update);
    });

    this.crdtService.remoteDiagramData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const canvas = this.canvasComponent();
        if (canvas) {
          canvas.applyExternalDiagramData(data);
        }
      });

    this.saveTrigger$
      .pipe(
        debounceTime(500),
        switchMap((diagramData) => {
          const current = this.board();
          if (!current || current.userRole === BoardRole.Viewer) {
            return of(null);
          }
          const request: UpdateCanvasDataRequest = {
            canvasDataJson: JSON.stringify(diagramData),
          };
          return this.boardService.updateCanvasData(current.id, request).pipe(
            tap(() => {
              this.saveStatus.set('saved');
              this.pendingDiagramData = null;
              this.board.update((b) =>
                b ? { ...b, canvasDataJson: request.canvasDataJson } : null,
              );
            }),
            catchError(() => {
              this.saveStatus.set('error');
              this.snackBar.open('Failed to save diagram changes.', 'Dismiss', {
                duration: 4000,
              });
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.destroyRef.onDestroy(() => {
      this.flushPendingSave();
      void this.realtimeService.stopConnection();
      this.crdtService.destroy();
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBoard(id);
    } else {
      this.errorMessage.set('No board ID provided.');
    }
  }

  toggleLiveCursors(): void {
    this.showLiveCursors.update((v) => !v);
  }

  handleCursorMove(point: CanvasPoint): void {
    void this.realtimeService.sendCursor(point.x, point.y);
  }

  private async initCollaboration(
    boardId: string,
    initialData?: CanvasDiagramData | null,
    crdtState?: string | null,
  ): Promise<void> {
    await this.crdtService.initBoard(boardId, initialData, crdtState);
    const syncInit = await this.realtimeService.startConnection(boardId);
    if (syncInit?.crdtState) {
      this.crdtService.applyRemoteUpdate(base64ToUint8Array(syncInit.crdtState));
    }
  }

  loadBoard(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.boardService.getBoardById(id).subscribe({
      next: (b) => {
        try {
          localStorage.setItem(`board_cache_${id}`, JSON.stringify(b));
        } catch {
          // Ignore localStorage errors
        }
        this.board.set(b);
        let parsed: CanvasDiagramData | null = null;
        if (b.canvasDataJson) {
          try {
            parsed = JSON.parse(b.canvasDataJson);
            this.isBoardEmpty.set(!parsed?.shapes || parsed.shapes.length === 0);
          } catch {
            this.isBoardEmpty.set(true);
          }
        } else {
          this.isBoardEmpty.set(true);
        }
        void this.initCollaboration(id, parsed, b.crdtState);
        this.isLoading.set(false);
      },
      error: (err) => {
        // Offline fallback: Check local storage cache if network fails
        const cached = localStorage.getItem(`board_cache_${id}`);
        if (cached) {
          try {
            const cachedBoard: BoardDetailDto = JSON.parse(cached);
            this.board.set(cachedBoard);
            void this.initCollaboration(id, null, cachedBoard.crdtState);
            this.isLoading.set(false);
            return;
          } catch {
            // Ignore parse errors
          }
        }

        this.isLoading.set(false);
        this.errorMessage.set(
          err?.status === 403
            ? 'You do not have permission to view this board.'
            : err?.status === 404
              ? 'Board not found.'
              : 'Failed to load board details.',
        );
      },
    });
  }

  handleDiagramChange(data: CanvasDiagramData): void {
    const current = this.board();
    if (!current || current.userRole === BoardRole.Viewer) {
      return;
    }
    this.crdtService.applyLocalDiagramChange(data);
    this.pendingDiagramData = data;
    this.isBoardEmpty.set(data.shapes.length === 0);
    this.saveStatus.set('saving');
    this.saveTrigger$.next(data);
  }

  flushPendingSave(): void {
    if (!this.pendingDiagramData) {
      return;
    }
    const current = this.board();
    if (!current || current.userRole === BoardRole.Viewer) {
      return;
    }
    const token = this.authService.token();
    const payload = JSON.stringify({
      canvasDataJson: JSON.stringify(this.pendingDiagramData),
    });
    this.pendingDiagramData = null;
    void fetch(`/api/boards/${current.id}/canvas`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Ignored: Best effort flush on window unload or component teardown
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  openSettingsDialog(): void {
    const current = this.board();
    if (!current) {
      return;
    }

    const isOwner = current.userRole === BoardRole.Owner;
    const isAdmin = current.userRole === BoardRole.Admin;

    const dialogRef = this.dialog.open<
      BoardSettingsDialogComponent,
      BoardSettingsDialogData,
      BoardSettingsDialogResult
    >(BoardSettingsDialogComponent, {
      width: '520px',
      data: {
        board: current,
        isOwner,
        isAdmin,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      if (result.action === 'deleted' || result.action === 'transferred') {
        this.router.navigate(['/dashboard']);
      } else if (result.action === 'updated') {
        this.board.set(result.board);
      }
    });
  }

  openMembersDialog(): void {
    const current = this.board();
    const currentUser = this.authService.currentUser();
    if (!current) {
      return;
    }

    const dialogRef = this.dialog.open<
      BoardMembersDialogComponent,
      BoardMembersDialogData,
      boolean
    >(BoardMembersDialogComponent, {
      width: '560px',
      data: {
        boardId: current.id,
        currentUserRole: current.userRole,
        currentUserId: currentUser?.id || '',
      },
    });

    dialogRef.afterClosed().subscribe((hasChanges) => {
      if (hasChanges) {
        this.loadBoard(current.id);
      }
    });
  }
}
