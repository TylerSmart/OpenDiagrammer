import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { BoardBackgroundType, CreateBoardRequest } from '../../../core/models/board.models';

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
  ],
  selector: 'app-create-board-dialog',
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon aria-hidden="true">dashboard_customize</mat-icon>
      <span>Create New Board</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Board Name</mat-label>
          <input
            matInput
            formControlName="name"
            placeholder="e.g., Architecture Roadmap"
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
            placeholder="Brief description of the diagram's purpose"
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
          <span id="opacity-slider-label" class="slider-label">
            Background Opacity: {{ (form.controls.backgroundOpacity.value * 100).toFixed(0) }}%
          </span>
          <mat-slider
            min="0"
            max="1"
            step="0.05"
            class="full-width"
            aria-labelledby="opacity-slider-label"
          >
            <input matSliderThumb formControlName="backgroundOpacity" />
          </mat-slider>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid"
        (click)="onSubmit()"
      >
        Create Board
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 320px;
      max-width: 500px;
      padding-top: 0.5rem;
    }
    .full-width {
      width: 100%;
    }
    .row {
      display: flex;
      gap: 1rem;
    }
    .half-width {
      flex: 1;
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
    }
    .slider-label {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.25rem;
    }
  `,
})
export class CreateBoardDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<CreateBoardDialogComponent>);
  protected readonly BoardBackgroundType = BoardBackgroundType;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl<string | null>(null, {
      validators: [Validators.maxLength(2000)],
    }),
    backgroundType: new FormControl<BoardBackgroundType>(BoardBackgroundType.GridLines, {
      nonNullable: true,
    }),
    backgroundColor: new FormControl<string>('#ffffff', { nonNullable: true }),
    backgroundOpacity: new FormControl<number>(1.0, { nonNullable: true }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateBoardRequest = {
      name: value.name.trim(),
      description: value.description?.trim() || null,
      backgroundType: value.backgroundType,
      backgroundColor: value.backgroundColor,
      backgroundOpacity: value.backgroundOpacity,
    };

    this.dialogRef.close(request);
  }
}
