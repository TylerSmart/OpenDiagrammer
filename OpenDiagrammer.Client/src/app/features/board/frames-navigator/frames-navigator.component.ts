import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CanvasShape, FRAME_PRESETS, FramePreset } from '../canvas/shape.models';

@Component({
  selector: 'app-frames-navigator',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './frames-navigator.component.html',
  styleUrl: './frames-navigator.component.scss',
})
export class FramesNavigatorComponent {
  readonly frames = input<CanvasShape[]>([]);
  readonly activeFrameId = input<string | null>(null);
  readonly readOnly = input<boolean>(false);

  readonly frameSelect = output<CanvasShape>();
  readonly frameAdd = output<FramePreset>();
  readonly frameRename = output<{ id: string; title: string }>();
  readonly frameDelete = output<string>();
  readonly frameReorder = output<{ frameId: string; direction: 'up' | 'down' }>();
  readonly closeNavigator = output<void>();
  readonly present = output<void>();

  readonly framePresets = FRAME_PRESETS;
  readonly editingFrameId = signal<string | null>(null);
  readonly editingTitle = signal<string>('');

  readonly activeIndex = computed(() => {
    const list = this.frames();
    const active = this.activeFrameId();
    if (!active) {
      return 0;
    }
    const idx = list.findIndex((f) => f.id === active);
    return idx >= 0 ? idx : 0;
  });

  handleSelect(frame: CanvasShape, event?: Event): void {
    event?.stopPropagation();
    this.frameSelect.emit(frame);
  }

  handleAdd(preset: FramePreset): void {
    if (this.readOnly()) {
      return;
    }
    this.frameAdd.emit(preset);
  }

  startRenaming(frame: CanvasShape, event?: Event): void {
    if (this.readOnly()) {
      return;
    }
    event?.stopPropagation();
    this.editingFrameId.set(frame.id);
    this.editingTitle.set(frame.text || 'Frame');
  }

  commitRenaming(frame: CanvasShape): void {
    const newTitle = this.editingTitle().trim();
    if (newTitle && newTitle !== frame.text) {
      this.frameRename.emit({ id: frame.id, title: newTitle });
    }
    this.editingFrameId.set(null);
  }

  cancelRenaming(): void {
    this.editingFrameId.set(null);
  }

  handleDelete(event: Event, frameId: string): void {
    if (this.readOnly()) {
      return;
    }
    event.stopPropagation();
    this.frameDelete.emit(frameId);
  }

  handleMove(event: Event, frameId: string, direction: 'up' | 'down'): void {
    if (this.readOnly()) {
      return;
    }
    event.stopPropagation();
    this.frameReorder.emit({ frameId, direction });
  }

  handlePrev(): void {
    const list = this.frames();
    if (list.length === 0) {
      return;
    }
    const current = this.activeIndex();
    const prevIndex = Math.max(0, current - 1);
    this.frameSelect.emit(list[prevIndex]);
  }

  handleNext(): void {
    const list = this.frames();
    if (list.length === 0) {
      return;
    }
    const current = this.activeIndex();
    const nextIndex = Math.min(list.length - 1, current + 1);
    this.frameSelect.emit(list[nextIndex]);
  }

  handlePresent(): void {
    this.present.emit();
  }
}
