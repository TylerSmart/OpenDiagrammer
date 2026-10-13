import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BoardDetailDto,
  BoardRevisionSummaryDto,
  BoardRole,
  canManageRevisions,
} from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';

export interface RevisionHistoryDialogData {
  boardId: string;
  userRole: BoardRole;
}

export interface RevisionHistoryDialogResult {
  restoredBoard?: BoardDetailDto;
}

@Component({
  selector: 'app-revision-history-dialog',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './revision-history-dialog.component.html',
  styleUrl: './revision-history-dialog.component.scss',
})
export class RevisionHistoryDialogComponent implements OnInit {
  protected readonly data = inject<RevisionHistoryDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(
    MatDialogRef<RevisionHistoryDialogComponent, RevisionHistoryDialogResult>,
  );
  private readonly fb = inject(FormBuilder);
  private readonly boardService = inject(BoardService);
  private readonly snackBar = inject(MatSnackBar);

  readonly revisions = signal<BoardRevisionSummaryDto[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isCreating = signal<boolean>(false);
  readonly restoringId = signal<string | null>(null);

  readonly canRestore = canManageRevisions(this.data.userRole);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    this.loadRevisions();
  }

  loadRevisions(): void {
    this.isLoading.set(true);
    this.boardService.getRevisions(this.data.boardId).subscribe({
      next: (list) => {
        this.revisions.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to load revision history.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  handleCreateSnapshot(): void {
    if (this.form.invalid || this.isCreating()) {
      return;
    }

    const { title, description } = this.form.value;
    if (!title?.trim()) {
      return;
    }

    this.isCreating.set(true);
    this.boardService
      .createRevision(this.data.boardId, {
        title: title.trim(),
        description: description?.trim() || null,
      })
      .subscribe({
        next: (created) => {
          this.isCreating.set(false);
          this.form.reset();
          this.revisions.update((list) => [
            {
              id: created.id,
              boardId: created.boardId,
              title: created.title,
              description: created.description,
              createdById: created.createdById,
              createdByUsername: created.createdByUsername,
              createdAt: created.createdAt,
            },
            ...list,
          ]);
          this.snackBar.open(`Snapshot "${created.title}" created.`, undefined, { duration: 2500 });
        },
        error: () => {
          this.isCreating.set(false);
          this.snackBar.open('Failed to create snapshot.', 'Dismiss', { duration: 3000 });
        },
      });
  }

  handleRestore(revision: BoardRevisionSummaryDto): void {
    if (this.restoringId() !== null) {
      return;
    }

    this.restoringId.set(revision.id);
    this.boardService.restoreRevision(this.data.boardId, revision.id).subscribe({
      next: (restoredBoard) => {
        this.restoringId.set(null);
        this.snackBar.open(`Restored board to "${revision.title}".`, undefined, { duration: 3000 });
        this.dialogRef.close({ restoredBoard });
      },
      error: () => {
        this.restoringId.set(null);
        this.snackBar.open('Failed to restore snapshot.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  handleClose(): void {
    this.dialogRef.close();
  }
}
