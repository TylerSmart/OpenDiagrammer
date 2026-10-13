import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CanvasExportService,
  ExportBackground,
  ExportFormat,
  computeExportBounds,
} from '../canvas/canvas-export.service';
import { RenderedConnection } from '../canvas/connection.models';
import { CanvasShape } from '../canvas/shape.models';

export interface ExportDialogData {
  boardName: string;
  shapes: CanvasShape[];
  connections: RenderedConnection[];
  frames: CanvasShape[];
  isDark: boolean;
}

@Component({
  selector: 'app-export-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatRadioModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './export-dialog.component.html',
  styleUrl: './export-dialog.component.scss',
})
export class ExportDialogComponent {
  protected readonly data = inject<ExportDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<ExportDialogComponent>);
  private readonly exportService = inject(CanvasExportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly selectedFormat = signal<ExportFormat>('png');
  readonly selectedArea = signal<string>('full'); // 'full' or frameId
  readonly selectedBackground = signal<ExportBackground>('theme');
  readonly isExporting = signal<boolean>(false);

  readonly availableFormats: {
    format: ExportFormat;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      format: 'png',
      label: 'PNG Image',
      description: 'High-resolution raster graphic with crisp transparency',
      icon: 'image',
    },
    {
      format: 'svg',
      label: 'SVG Vector',
      description: 'Infinite resolution scalable vector document',
      icon: 'code',
    },
    {
      format: 'jpeg',
      label: 'JPEG Image',
      description: 'Compressed photo format with solid background',
      icon: 'photo_camera',
    },
    {
      format: 'pdf',
      label: 'PDF Document',
      description: 'Standard printable document for sharing and presentations',
      icon: 'picture_as_pdf',
    },
  ];

  readonly estimatedBounds = computed(() => {
    const frameId = this.selectedArea() === 'full' ? null : this.selectedArea();
    return computeExportBounds(this.data.shapes, this.data.connections, frameId);
  });

  async handleExport(): Promise<void> {
    if (this.isExporting()) {
      return;
    }

    this.isExporting.set(true);

    try {
      const frameId = this.selectedArea() === 'full' ? null : this.selectedArea();
      await this.exportService.downloadExport({
        shapes: this.data.shapes,
        connections: this.data.connections,
        frameId,
        format: this.selectedFormat(),
        background: this.selectedBackground(),
        isDark: this.data.isDark,
        boardName: this.data.boardName || 'board',
      });

      this.snackBar.open(
        `Export completed: ${this.selectedFormat().toUpperCase()} downloaded.`,
        'Close',
        { duration: 3500 },
      );

      this.dialogRef.close(true);
    } catch (err) {
      console.error('Export failed:', err);
      this.snackBar.open(
        `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'Close',
        { duration: 5000 },
      );
    } finally {
      this.isExporting.set(false);
    }
  }

  handleCancel(): void {
    this.dialogRef.close(false);
  }
}
