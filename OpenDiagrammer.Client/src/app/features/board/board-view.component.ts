import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BoardBackgroundType,
  BoardDetailDto,
  BoardMode,
  BoardRole,
  canManageBoardSettings,
  getRoleName,
} from '../../core/models/board.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { BoardService } from '../../core/services/board/board.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import { CanvasComponent } from './canvas/canvas.component';
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
})
export class BoardViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly boardService = inject(BoardService);
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly board = signal<BoardDetailDto | null>(null);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly BoardBackgroundType = BoardBackgroundType;
  protected readonly BoardMode = BoardMode;
  protected readonly getRoleName = getRoleName;
  protected readonly canManageSettings = canManageBoardSettings;

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBoard(id);
    } else {
      this.errorMessage.set('No board ID provided.');
    }
  }

  loadBoard(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.boardService.getBoardById(id).subscribe({
      next: (b) => {
        this.board.set(b);
        this.isLoading.set(false);
      },
      error: (err) => {
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
