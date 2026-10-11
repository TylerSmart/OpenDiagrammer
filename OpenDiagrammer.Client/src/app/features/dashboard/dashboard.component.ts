import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import {
  BoardRole,
  BoardSummaryDto,
  CreateBoardRequest,
  canDeleteBoard,
  canManageBoardSettings,
  canManageMembers,
  getRoleName,
} from '../../core/models/board.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { BoardService } from '../../core/services/board/board.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';
import {
  BoardMembersDialogComponent,
  BoardMembersDialogData,
} from '../board/board-members-dialog/board-members-dialog.component';
import {
  BoardSettingsDialogComponent,
  BoardSettingsDialogData,
  BoardSettingsDialogResult,
} from '../board/board-settings-dialog/board-settings-dialog.component';
import { ConfirmDialogComponent } from './confirm-delete-dialog/confirm-delete-dialog.component';
import { CreateBoardDialogComponent } from './create-board-dialog/create-board-dialog.component';

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
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly boardService = inject(BoardService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly boards = signal<BoardSummaryDto[]>([]);
  protected readonly searchQuery = signal<string>('');
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly getRoleName = getRoleName;
  protected readonly canManageSettings = canManageBoardSettings;
  protected readonly canManageMembers = canManageMembers;
  protected readonly canDelete = canDeleteBoard;

  protected readonly filteredBoards = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.boards();
    if (!query) {
      return list;
    }
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        (b.description && b.description.toLowerCase().includes(query)),
    );
  });

  protected readonly userInitial = computed(() => {
    const user = this.authService.currentUser();
    return user?.username ? user.username.charAt(0).toUpperCase() : 'U';
  });

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  ngOnInit(): void {
    this.loadBoards();
  }

  loadBoards(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.boardService.getBoards().subscribe({
      next: (list) => {
        this.boards.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || err?.error?.title || 'Failed to load boards.');
      },
    });
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  openCreateBoardDialog(): void {
    const dialogRef = this.dialog.open(CreateBoardDialogComponent, {
      width: '480px',
    });

    dialogRef.afterClosed().subscribe((result: CreateBoardRequest | undefined) => {
      if (!result) {
        return;
      }

      this.boardService.createBoard(result).subscribe({
        next: (newBoard) => {
          this.snackBar.open(`Board "${newBoard.name}" created`, 'Close', {
            duration: 3000,
          });
          this.navigateToBoard(newBoard.id);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to create board', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  openSettingsDialog(board: BoardSummaryDto): void {
    const isOwner = board.userRole === BoardRole.Owner;
    const isAdmin = board.userRole === BoardRole.Admin;

    const dialogRef = this.dialog.open<
      BoardSettingsDialogComponent,
      BoardSettingsDialogData,
      BoardSettingsDialogResult
    >(BoardSettingsDialogComponent, {
      width: '520px',
      data: {
        board,
        isOwner,
        isAdmin,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      if (result.action === 'deleted') {
        this.boards.update((list) => list.filter((b) => b.id !== board.id));
      } else if (result.action === 'updated' || result.action === 'transferred') {
        this.loadBoards();
      }
    });
  }

  openMembersDialog(board: BoardSummaryDto): void {
    const currentUser = this.authService.currentUser();
    const dialogRef = this.dialog.open<
      BoardMembersDialogComponent,
      BoardMembersDialogData,
      boolean
    >(BoardMembersDialogComponent, {
      width: '560px',
      data: {
        boardId: board.id,
        currentUserRole: board.userRole,
        currentUserId: currentUser?.id || '',
      },
    });

    dialogRef.afterClosed().subscribe((hasChanges) => {
      if (hasChanges) {
        this.loadBoards();
      }
    });
  }

  deleteBoard(board: BoardSummaryDto): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Board',
        message: `Are you sure you want to delete "${board.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.boardService.deleteBoard(board.id).subscribe({
        next: () => {
          this.boards.update((list) => list.filter((b) => b.id !== board.id));
          this.snackBar.open(`Board "${board.name}" deleted`, 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          this.snackBar.open(err?.error?.detail || 'Failed to delete board', 'Close', {
            duration: 4000,
          });
        },
      });
    });
  }

  navigateToBoard(id: string): void {
    this.router.navigate(['/board', id]);
  }

  onLogout(): void {
    this.authService.logout();
  }
}
