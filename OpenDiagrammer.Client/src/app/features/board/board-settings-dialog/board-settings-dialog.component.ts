import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  BoardBackgroundType,
  BoardDetailDto,
  BoardMode,
  BoardSummaryDto,
  UpdateBoardRequest,
} from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';
import { ConfirmDialogComponent } from '../../dashboard/confirm-delete-dialog/confirm-delete-dialog.component';

export interface BoardSettingsDialogData {
  board: BoardDetailDto | BoardSummaryDto;
  isOwner: boolean;
  isAdmin: boolean;
}

export type BoardSettingsDialogResult =
  { action: 'updated'; board: BoardDetailDto } | { action: 'deleted' } | { action: 'transferred' };

@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  selector: 'app-board-settings-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon aria-hidden="true">settings</mat-icon>
      <span>Board Settings</span>
    </h2>

    <mat-dialog-content>
      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          <mat-icon aria-hidden="true">error</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <form [formGroup]="form" class="dialog-form" (ngSubmit)="onSave()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Board Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="Board Name"
            required
            maxlength="200"
          />
          @if (form.controls.name.hasError('required') && form.controls.name.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            placeholder="Description of the diagram"
            maxlength="2000"
          ></textarea>
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Canvas Background</mat-label>
            <mat-select formControlName="backgroundType">
              <mat-option [value]="BoardBackgroundType.GridLines">Grid Lines</mat-option>
              <mat-option [value]="BoardBackgroundType.GridDots">Grid Dots</mat-option>
              <mat-option [value]="BoardBackgroundType.None">Blank / None</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="half-width">
            <mat-label>Canvas Color</mat-label>
            <input
              matInput
              type="color"
              formControlName="backgroundColor"
              class="color-picker-input"
            />
          </mat-form-field>
        </div>

        <div class="slider-field">
          <span id="settings-opacity-label" class="slider-label">
            Background Opacity: {{ (form.controls.backgroundOpacity.value * 100).toFixed(0) }}%
          </span>
          <mat-slider
            min="0"
            max="1"
            step="0.05"
            class="full-width"
            aria-labelledby="settings-opacity-label"
          >
            <input matSliderThumb formControlName="backgroundOpacity" />
          </mat-slider>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Board Mode</mat-label>
          <mat-select formControlName="mode">
            <mat-option [value]="BoardMode.Normal">Normal Mode</mat-option>
            <mat-option [value]="BoardMode.ThinkMode">Think Mode</mat-option>
          </mat-select>
        </mat-form-field>
      </form>

      @if (data.isOwner) {
        <mat-divider class="section-divider"></mat-divider>

        <div class="owner-section">
          <h3>Ownership Transfer</h3>
          <p class="section-hint">
            Transfer full ownership of this board to another user by their user ID.
          </p>
          <div class="transfer-row">
            <mat-form-field appearance="outline" class="transfer-input">
              <mat-label>New Owner User ID (GUID)</mat-label>
              <input
                matInput
                [formControl]="newOwnerIdControl"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </mat-form-field>
            <button
              mat-stroked-button
              color="primary"
              type="button"
              [disabled]="newOwnerIdControl.invalid || isTransferring()"
              (click)="onTransferOwnership()"
            >
              Transfer
            </button>
          </div>
        </div>

        <mat-divider class="section-divider"></mat-divider>

        <div class="danger-zone">
          <h3>Danger Zone</h3>
          <p class="section-hint">Permanently delete this board and all of its diagram data.</p>
          <button
            mat-flat-button
            color="warn"
            type="button"
            (click)="onDeleteBoard()"
            [disabled]="isDeleting()"
          >
            <mat-icon>delete_forever</mat-icon>
            <span>Delete Board</span>
          </button>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid || isSaving()"
        (click)="onSave()"
      >
        @if (isSaving()) {
          <span>Saving...</span>
        } @else {
          <span>Save Changes</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 100%;
      box-sizing: border-box;
      padding-top: 0.5rem;
    }
    .full-width {
      width: 100%;
      box-sizing: border-box;
    }
    .row {
      display: flex;
      gap: 1rem;
      width: 100%;
      box-sizing: border-box;
    }
    .half-width {
      flex: 1;
      min-width: 0;
    }
    .color-picker-input {
      padding: 0;
      height: 2rem;
      cursor: pointer;
    }
    .slider-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 0.5rem;
      width: 100%;
      box-sizing: border-box;

      mat-slider {
        width: calc(100% - 16px);
        max-width: calc(100% - 16px);
      }
    }
    .slider-label {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.25rem;
    }
    .section-divider {
      margin: 1.5rem 0 1rem;
    }
    .owner-section,
    .danger-zone {
      width: 100%;
      box-sizing: border-box;

      h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
        font-weight: 600;
      }
      .section-hint {
        margin: 0 0 0.75rem;
        font-size: 0.8125rem;
        color: var(--mat-sys-on-surface-variant);
        word-break: break-word;
      }
    }
    .transfer-row {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      width: 100%;
      box-sizing: border-box;

      button {
        flex-shrink: 0;
        white-space: nowrap;
        height: 56px;
      }
    }
    .transfer-input {
      flex: 1;
      min-width: 0;
    }
    .danger-zone button {
      max-width: 100%;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 0.5rem;
      background-color: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font-size: 0.875rem;
    }
  `,
})
export class BoardSettingsDialogComponent {
  protected readonly data = inject<BoardSettingsDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef =
    inject<MatDialogRef<BoardSettingsDialogComponent, BoardSettingsDialogResult>>(MatDialogRef);
  private readonly boardService = inject(BoardService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly BoardBackgroundType = BoardBackgroundType;
  protected readonly BoardMode = BoardMode;

  protected readonly isSaving = signal<boolean>(false);
  protected readonly isTransferring = signal<boolean>(false);
  protected readonly isDeleting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.board.name, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl<string | null>(this.data.board.description, {
      validators: [Validators.maxLength(2000)],
    }),
    backgroundType: new FormControl<BoardBackgroundType>(this.data.board.backgroundType, {
      nonNullable: true,
    }),
    backgroundColor: new FormControl<string>(this.data.board.backgroundColor || '#ffffff', {
      nonNullable: true,
    }),
    backgroundOpacity: new FormControl<number>(this.data.board.backgroundOpacity ?? 1.0, {
      nonNullable: true,
    }),
    mode: new FormControl<BoardMode>(this.data.board.mode, {
      nonNullable: true,
    }),
  });

  protected readonly newOwnerIdControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      ),
    ],
  });

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const updateRequest: UpdateBoardRequest = {
      name: value.name.trim(),
      description: value.description?.trim() || null,
      backgroundType: value.backgroundType,
      backgroundColor: value.backgroundColor,
      backgroundOpacity: value.backgroundOpacity,
      mode: value.mode,
      thinkModeConfigJson: null,
    };

    this.boardService.updateBoard(this.data.board.id, updateRequest).subscribe({
      next: (updatedBoard) => {
        this.isSaving.set(false);
        this.snackBar.open('Board settings updated', 'Close', {
          duration: 3000,
        });
        this.dialogRef.close({ action: 'updated', board: updatedBoard });
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || err?.error?.title || 'Failed to update board.');
      },
    });
  }

  onTransferOwnership(): void {
    if (this.newOwnerIdControl.invalid) {
      return;
    }

    const newOwnerId = this.newOwnerIdControl.value.trim();
    this.isTransferring.set(true);
    this.errorMessage.set(null);

    this.boardService.transferOwnership(this.data.board.id, { newOwnerId }).subscribe({
      next: () => {
        this.isTransferring.set(false);
        this.snackBar.open('Ownership transferred successfully', 'Close', {
          duration: 3000,
        });
        this.dialogRef.close({ action: 'transferred' });
      },
      error: (err) => {
        this.isTransferring.set(false);
        this.errorMessage.set(
          err?.error?.detail || err?.error?.title || 'Failed to transfer ownership.',
        );
      },
    });
  }

  onDeleteBoard(): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Board',
        message: `Are you sure you want to delete "${this.data.board.name}"? All diagram data will be lost.`,
        confirmText: 'Delete Board',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.isDeleting.set(true);
      this.boardService.deleteBoard(this.data.board.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.snackBar.open('Board deleted', 'Close', { duration: 3000 });
          this.dialogRef.close({ action: 'deleted' });
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.errorMessage.set(
            err?.error?.detail || err?.error?.title || 'Failed to delete board.',
          );
        },
      });
    });
  }
}
