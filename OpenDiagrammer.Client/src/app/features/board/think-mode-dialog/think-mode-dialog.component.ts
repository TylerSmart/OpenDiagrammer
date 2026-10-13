import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ThinkModeConfig, ThinkModeGroup } from '../../../core/models/board.models';

export interface ThinkModeDialogData {
  boardId: string;
  isCurrentlyActive: boolean;
  currentConfig: ThinkModeConfig | null;
}

export interface ThinkModeDialogResult {
  action: 'start' | 'update' | 'end';
  config?: ThinkModeConfig;
}

interface GroupEntry {
  id: string;
  name: string;
  membersText: string;
}

@Component({
  selector: 'app-think-mode-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon class="title-icon">psychology</mat-icon>
      <span>{{ data.isCurrentlyActive ? 'Think Mode Settings' : 'Start Think Mode' }}</span>
    </h2>

    <mat-dialog-content class="dialog-content">
      <p class="dialog-description">
        Think Mode turns the board into a focused brainstorming session where participants ideate
        using sticky notes.
      </p>

      <form [formGroup]="form" class="think-form">
        <!-- Timer Duration -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Session Timer</mat-label>
          <mat-select formControlName="timerPreset">
            <mat-option [value]="0">No timer (manual end)</mat-option>
            <mat-option [value]="60">1 minute</mat-option>
            <mat-option [value]="180">3 minutes</mat-option>
            <mat-option [value]="300">5 minutes</mat-option>
            <mat-option [value]="600">10 minutes</mat-option>
            <mat-option [value]="900">15 minutes</mat-option>
            <mat-option [value]="1800">30 minutes</mat-option>
            <mat-option [value]="-1">Custom duration</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.value.timerPreset === -1) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Duration (minutes)</mat-label>
            <input
              matInput
              type="number"
              formControlName="customMinutes"
              min="1"
              max="240"
              placeholder="e.g. 7"
            />
          </mat-form-field>
        }

        <!-- Viewer Participation -->
        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-label">Viewer Participation</span>
            <span class="toggle-hint">
              Allow viewers to place and edit sticky notes while keeping other diagram elements
              protected.
            </span>
          </div>
          <mat-slide-toggle
            formControlName="viewerParticipation"
            color="primary"
          ></mat-slide-toggle>
        </div>

        <!-- Blind Ideation (Hide Others' Writing) -->
        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-label">Blind Ideation (Hide Others' Notes)</span>
            <span class="toggle-hint">
              Keep participants' notes concealed until Think Mode ends or timer expires to avoid
              anchoring.
            </span>
          </div>
          <mat-slide-toggle formControlName="hideOthersWriting" color="primary"></mat-slide-toggle>
        </div>

        <!-- Groups Configuration Section -->
        <div class="groups-section">
          <div class="groups-header">
            <div>
              <span class="toggle-label">Collaboration Groups (Optional)</span>
              <p class="toggle-hint">
                Members in the same group can see each other's sticky notes during Blind Ideation.
              </p>
            </div>
            <button mat-stroked-button type="button" (click)="addGroup()" class="add-group-btn">
              <mat-icon>group_add</mat-icon>
              <span>Add Group</span>
            </button>
          </div>

          @for (grp of groups(); track grp.id) {
            <div class="group-row">
              <mat-form-field appearance="outline" class="group-name-field">
                <mat-label>Group Name</mat-label>
                <input
                  matInput
                  [value]="grp.name"
                  (input)="updateGroupName(grp.id, $any($event.target).value)"
                  placeholder="Team A"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="group-members-field">
                <mat-label>Usernames (comma separated)</mat-label>
                <input
                  matInput
                  [value]="grp.membersText"
                  (input)="updateGroupMembers(grp.id, $any($event.target).value)"
                  placeholder="alice, bob, charlie"
                />
              </mat-form-field>

              <button
                mat-icon-button
                type="button"
                (click)="removeGroup(grp.id)"
                color="warn"
                aria-label="Remove group"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      @if (data.isCurrentlyActive) {
        <button mat-button color="warn" (click)="onEndThinkMode()" class="end-btn">
          <mat-icon>stop</mat-icon>
          <span>End Think Mode</span>
        </button>
      }

      <button mat-button mat-dialog-close>Cancel</button>

      <button mat-flat-button color="primary" (click)="onSubmit()" [disabled]="form.invalid">
        <mat-icon>{{ data.isCurrentlyActive ? 'save' : 'play_arrow' }}</mat-icon>
        <span>{{ data.isCurrentlyActive ? 'Save Settings' : 'Start Think Mode' }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      padding: 1.25rem 1.5rem 0.5rem;

      .title-icon {
        color: var(--mat-sys-primary);
      }
    }

    .dialog-content {
      padding: 0.5rem 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 75vh;
    }

    .dialog-description {
      margin: 0 0 0.5rem;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.4;
    }

    .think-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .full-width {
      width: 100%;
    }

    .toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background-color: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);

      .toggle-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .toggle-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }

      .toggle-hint {
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        line-height: 1.3;
      }
    }

    .groups-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background-color: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .groups-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .group-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;

      .group-name-field {
        width: 140px;
        flex-shrink: 0;
      }

      .group-members-field {
        flex: 1;
      }
    }

    .dialog-actions {
      padding: 0.75rem 1.5rem 1.25rem;
      gap: 0.5rem;

      .end-btn {
        margin-right: auto;
      }
    }
  `,
})
export class ThinkModeDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ThinkModeDialogComponent>);
  readonly data = inject<ThinkModeDialogData>(MAT_DIALOG_DATA);

  readonly groups = signal<GroupEntry[]>([]);

  readonly form = this.fb.nonNullable.group({
    timerPreset: [300],
    customMinutes: [5, [Validators.min(1), Validators.max(240)]],
    viewerParticipation: [true],
    hideOthersWriting: [true],
  });

  constructor() {
    const config = this.data.currentConfig;
    if (config) {
      let preset = 0;
      let customMin = 5;
      if (config.timerSeconds) {
        if ([60, 180, 300, 600, 900, 1800].includes(config.timerSeconds)) {
          preset = config.timerSeconds;
        } else {
          preset = -1;
          customMin = Math.round(config.timerSeconds / 60);
        }
      }
      this.form.patchValue({
        timerPreset: preset,
        customMinutes: customMin,
        viewerParticipation: config.viewerParticipation ?? true,
        hideOthersWriting: config.hideOthersWriting ?? true,
      });

      if (config.groups && config.groups.length > 0) {
        this.groups.set(
          config.groups.map((g) => ({
            id: g.id,
            name: g.name,
            membersText: g.memberUsernames.join(', '),
          })),
        );
      }
    }
  }

  addGroup(): void {
    const count = this.groups().length + 1;
    this.groups.update((list) => [
      ...list,
      {
        id: `g_${Date.now()}`,
        name: `Team ${String.fromCharCode(64 + count)}`,
        membersText: '',
      },
    ]);
  }

  removeGroup(id: string): void {
    this.groups.update((list) => list.filter((g) => g.id !== id));
  }

  updateGroupName(id: string, name: string): void {
    this.groups.update((list) => list.map((g) => (g.id === id ? { ...g, name } : g)));
  }

  updateGroupMembers(id: string, membersText: string): void {
    this.groups.update((list) => list.map((g) => (g.id === id ? { ...g, membersText } : g)));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }
    const val = this.form.getRawValue();
    let timerSec = val.timerPreset;
    if (timerSec === -1) {
      timerSec = (val.customMinutes || 5) * 60;
    }

    const now = new Date();
    const endsAt = timerSec > 0 ? new Date(now.getTime() + timerSec * 1000).toISOString() : null;

    const parsedGroups: ThinkModeGroup[] = this.groups()
      .map((g) => ({
        id: g.id,
        name: g.name.trim() || 'Team',
        memberUsernames: g.membersText
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m.length > 0),
      }))
      .filter((g) => g.memberUsernames.length > 0);

    const config: ThinkModeConfig = {
      timerSeconds: timerSec > 0 ? timerSec : undefined,
      timerStartedAt: timerSec > 0 ? now.toISOString() : null,
      timerEndsAt: endsAt,
      isTimerRunning: timerSec > 0,
      viewerParticipation: val.viewerParticipation,
      hideOthersWriting: val.hideOthersWriting,
      groups: parsedGroups.length > 0 ? parsedGroups : undefined,
    };

    this.dialogRef.close({
      action: this.data.isCurrentlyActive ? 'update' : 'start',
      config,
    } as ThinkModeDialogResult);
  }

  onEndThinkMode(): void {
    this.dialogRef.close({ action: 'end' } as ThinkModeDialogResult);
  }
}
