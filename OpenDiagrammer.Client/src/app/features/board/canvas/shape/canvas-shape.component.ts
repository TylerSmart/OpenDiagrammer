import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AnchorPosition } from '../connection.models';
import { CanvasShape, computeFittingFontSize, sanitizeRichText } from '../shape.models';

@Component({
  selector: 'app-canvas-shape',
  templateUrl: './canvas-shape.component.html',
  styleUrl: './canvas-shape.component.scss',
})
export class CanvasShapeComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly shape = input.required<CanvasShape>();
  readonly isSelected = input<boolean>(false);
  readonly showAnchors = input<boolean>(false);
  readonly allowHoverAnchors = input<boolean>(true);
  readonly isEditing = input<boolean>(false);

  readonly isHovered = signal<boolean>(false);

  readonly shapeDoubleClick = output<CanvasShape>();

  readonly anchorPointerDown = output<{
    event: PointerEvent;
    shape: CanvasShape;
    anchor: AnchorPosition;
  }>();

  readonly anchorHover = output<{
    shape: CanvasShape;
    anchor: AnchorPosition;
  } | null>();

  readonly anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];

  readonly shapeStyles = computed(() => {
    const s = this.shape();
    return {
      transform: `translate(${s.x}px, ${s.y}px)`,
      width: `${s.width}px`,
      height: `${s.height}px`,
      zIndex: 10 + s.zIndex,
    };
  });

  readonly diamondPoints = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
  });

  readonly textColor = computed(() => {
    const fill = this.shape().fillColor;
    if (fill.includes('inverse')) {
      return 'var(--canvas-color-inverse-text)';
    }
    return 'var(--mat-sys-on-surface)';
  });

  readonly fittingFontSize = computed(() => {
    const s = this.shape();
    return computeFittingFontSize(s.text, s.width, s.height, s.fontSize || 14);
  });

  readonly safeHtml = computed<SafeHtml>(() => {
    const text = this.shape().text;
    if (!text) {
      return '';
    }
    const sanitized = sanitizeRichText(text);
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  });

  handleDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.shapeDoubleClick.emit(this.shape());
  }

  handleAnchorDown(event: PointerEvent, anchor: AnchorPosition): void {
    event.stopPropagation();
    this.anchorPointerDown.emit({
      event,
      shape: this.shape(),
      anchor,
    });
  }

  handleAnchorEnter(anchor: AnchorPosition): void {
    this.anchorHover.emit({ shape: this.shape(), anchor });
  }

  handleAnchorLeave(): void {
    this.anchorHover.emit(null);
  }
}
