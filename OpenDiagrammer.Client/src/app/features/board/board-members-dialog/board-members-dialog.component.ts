import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  BoardMemberDto,
  BoardRole,
  canManageMembers,
  getRoleName,
} from '../../../core/models/board.models';
import { BoardService } from '../../../core/services/board/board.service';
import { ConfirmDialogComponent } from '../../dashboard/confirm-delete-dialog/confirm-delete-dialog.component';

export interface BoardMembersDialogData {
  boardId: string;
  currentUserRole: BoardRole;
  currentUserId: string;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-board-members-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon aria-hidden="true">group</mat-icon>
      <span>Manage Members</span>
    </h2>

    <mat-dialog-content>
      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          <mat-icon aria-hidden="true">error</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      @if (canAddMembers()) {
        <div class="add-member-section">
          <h3>Add Collaborator</h3>
          <form [formGroup]="addMemberForm" (ngSubmit)="onAddMember()" class="add-member-form">
            <mat-form-field appearance="outline" class="add-input">
              <mat-label>Email or Username</mat-label>
              <input
                matInput
                formControlName="emailOrUsername"
                placeholder="colleague@example.com"
                required
              />
              @if (
                addMemberForm.controls.emailOrUsername.hasError('required') &&
                addMemberForm.controls.emailOrUsername.touched
              ) {
                <mat-error>Email or username is required</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="role-select">
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                @if (data.currentUserRole === BoardRole.Owner) {
                  <mat-option [value]="BoardRole.Admin">Admin</mat-option>
                }
                <mat-option [value]="BoardRole.Editor">Editor</mat-option>
                <mat-option [value]="BoardRole.Viewer">Viewer</mat-option>
              </mat-select>
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="add-btn"
              [disabled]="addMemberForm.invalid || isAdding()"
            >
              @if (!isAdding()) {
                <mat-icon>person_add</mat-icon>
              }
              <span>{{ isAdding() ? 'Adding...' : 'Add' }}</span>
            </button>
          </form>
        </div>

        <mat-divider class="section-divider"></mat-divider>
      }

      <div class="members-list-section">
        <h3>Current Members ({{ members().length }})</h3>

        @if (isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="32"></mat-spinner>
            <span>Loading members...</span>
          </div>
        } @else {
          <div class="members-list">
            @for (member of members(); track member.id) {
              <div class="member-item">
                <div class="member-avatar" aria-hidden="true">
                  {{ member.username.charAt(0).toUpperCase() }}
                </div>

                <div class="member-info">
                  <div class="member-name">{{ member.username }}</div>
                  <div class="member-email">{{ member.email }}</div>
                </div>

                <div class="member-role-action">
                  @if (canChangeRoleOf(member)) {
                    <mat-form-field appearance="outline" class="mini-role-select">
                      <mat-select
                        [value]="member.role"
                        (selectionChange)="onChangeRole(member, $event.value)"
                      >
                        @if (data.currentUserRole === BoardRole.Owner) {
                          <mat-option [value]="BoardRole.Admin">Admin</mat-option>
                        }
                        <mat-option [value]="BoardRole.Editor">Editor</mat-option>
                        <mat-option [value]="BoardRole.Viewer">Viewer</mat-option>
                      </mat-select>
                    </mat-form-field>
                  } @else {
                    <span
                      class="role-badge"
                      [class]="'role-' + getRoleName(member.role).toLowerCase()"
                    >
                      {{ getRoleName(member.role) }}
                    </span>
                  }

                  @if (canRemove(member)) {
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="onRemoveMember(member)"
                      [attr.aria-label]="'Remove ' + member.username"
                    >
                      <mat-icon>person_remove</mat-icon>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="dialogRef.close(hasChanges())">Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .add-member-section,
    .members-list-section {
      min-width: 320px;
      max-width: 560px;

      h3 {
        margin: 0 0 0.75rem;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }
    }
    .add-member-form {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .add-input {
      flex: 2;
      min-width: 180px;
    }
    .role-select {
      flex: 1;
      min-width: 120px;
    }
    .add-btn {
      height: 52px;
    }
    .section-divider {
      margin: 1.25rem 0;
    }
    .loading-state {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .members-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: 320px;
      overflow-y: auto;
    }
    .member-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background-color: var(--mat-sys-surface-container-low);
    }
    .member-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .member-info {
      flex: 1;
      overflow: hidden;
    }
    .member-name {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .member-email {
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .member-role-action {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .mini-role-select {
      width: 110px;
      margin-bottom: -1.25rem;
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
export class BoardMembersDialogComponent implements OnInit {
  protected readonly data = inject<BoardMembersDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<BoardMembersDialogComponent>);
  private readonly boardService = inject(BoardService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly BoardRole = BoardRole;
  protected readonly getRoleName = getRoleName;

  protected readonly members = signal<BoardMemberDto[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly isAdding = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hasChanges = signal<boolean>(false);

  protected readonly addMemberForm = new FormGroup({
    emailOrUsername: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    role: new FormControl<BoardRole>(BoardRole.Editor, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.isLoading.set(true);
    this.boardService.getMembers(this.data.boardId).subscribe({
      next: (list) => {
        this.members.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err?.error?.detail || err?.error?.title || 'Failed to load members.');
      },
    });
  }

  canAddMembers(): boolean {
    return canManageMembers(this.data.currentUserRole);
  }

  canChangeRoleOf(member: BoardMemberDto): boolean {
    if (member.role === BoardRole.Owner) {
      return false;
    }
    if (this.data.currentUserRole === BoardRole.Owner) {
      return true;
    }
    if (this.data.currentUserRole === BoardRole.Admin) {
      return member.role === BoardRole.Editor || member.role === BoardRole.Viewer;
    }
    return false;
  }

  canRemove(member: BoardMemberDto): boolean {
    if (member.role === BoardRole.Owner) {
      return false;
    }
    if (this.data.currentUserRole === BoardRole.Owner) {
      return true;
    }
    if (this.data.currentUserRole === BoardRole.Admin) {
      return member.role === BoardRole.Editor || member.role === BoardRole.Viewer;
    }
    return false;
  }

  onAddMember(): void {
    if (this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    this.isAdding.set(true);
    this.errorMessage.set(null);

    const formVal = this.addMemberForm.getRawValue();
    this.boardService
      .addMember(this.data.boardId, {
        emailOrUsername: formVal.emailOrUsername.trim(),
        role: formVal.role,
      })
      .subscribe({
        next: (newMember) => {
          this.isAdding.set(false);
          this.members.update((list) => [...list, newMember]);
          this.hasChanges.set(true);
          this.addMemberForm.controls.emailOrUsername.reset();
          this.snackBar.open(`Added ${newMember.username} to board`, 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          this.isAdding.set(false);
          this.errorMessage.set(
            err?.error?.detail || err?.error?.title || 'Failed to add member to board.',
          );
        },
      });
  }

  onChangeRole(member: BoardMemberDto, newRole: BoardRole): void {
    this.errorMessage.set(null);
    this.boardService
      .updateMemberRole(this.data.boardId, member.userId, { role: newRole })
      .subscribe({
        next: (updated) => {
          this.members.update((list) =>
            list.map((m) => (m.userId === updated.userId ? updated : m)),
          );
          this.hasChanges.set(true);
          this.snackBar.open(`Updated ${member.username}'s role`, 'Close', {
            duration: 2500,
          });
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.detail ||
              err?.error?.title ||
              `Failed to update role for ${member.username}.`,
          );
        },
      });
  }

  onRemoveMember(member: BoardMemberDto): void {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove Member',
        message: `Remove "${member.username}" from this board?`,
        confirmText: 'Remove',
        isDestructive: true,
      },
    });

    confirmRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.boardService.removeMember(this.data.boardId, member.userId).subscribe({
        next: () => {
          this.members.update((list) => list.filter((m) => m.userId !== member.userId));
          this.hasChanges.set(true);
          this.snackBar.open(`Removed ${member.username}`, 'Close', {
            duration: 2500,
          });
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.detail || err?.error?.title || `Failed to remove ${member.username}.`,
          );
        },
      });
    });
  }
}
