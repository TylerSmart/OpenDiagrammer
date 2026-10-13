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
  readonly isMasked = input<boolean>(false);

  readonly isHovered = signal<boolean>(false);

  readonly shapeDoubleClick = output<CanvasShape>();
  readonly pullStickyNote = output<CanvasShape>();

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

  readonly isFrame = computed(() => this.shape().type === 'frame');

  readonly shapeStyles = computed(() => {
    const s = this.shape();
    return {
      transform: `translate(${s.x}px, ${s.y}px)`,
      width: `${s.width}px`,
      height: `${s.height}px`,
      zIndex: s.type === 'frame' ? Math.max(1, s.zIndex) : 10 + s.zIndex,
    };
  });

  readonly diamondPoints = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
  });

  readonly trianglePoints = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    return `${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`;
  });

  readonly flowchartIoPoints = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    const slant = Math.min(24, Math.round(w * 0.2));
    return `${slant},1 ${w - 1},1 ${w - slant},${h - 1} 1,${h - 1}`;
  });

  readonly flowchartDocumentPath = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    return `M 1 1 L ${w - 1} 1 L ${w - 1} ${h - 14} Q ${w * 0.75} ${h - 24} ${w * 0.5} ${h - 14} Q ${w * 0.25} ${h - 4} 1 ${h - 14} Z`;
  });

  readonly flowchartDatabaseBodyPath = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    const ry = Math.min(14, Math.round(h * 0.2));
    return `M 1 ${ry} A ${(w - 2) / 2} ${ry} 0 0 0 ${w - 1} ${ry} L ${w - 1} ${h - ry} A ${(w - 2) / 2} ${ry} 0 0 1 1 ${h - ry} Z`;
  });

  readonly flowchartDatabaseRy = computed(() =>
    Math.min(14, Math.round(this.shape().height * 0.2)),
  );

  readonly umlClassDivider1 = computed(() => Math.round(this.shape().height * 0.28));
  readonly umlClassDivider2 = computed(() => Math.round(this.shape().height * 0.62));
  readonly umlInterfaceDivider = computed(() => Math.round(this.shape().height * 0.38));

  readonly umlPackageTabPath = computed(() => {
    const s = this.shape();
    const tabW = Math.min(60, Math.round(s.width * 0.45));
    const tabH = Math.min(20, Math.round(s.height * 0.2));
    return `M 1 ${tabH} L 1 1 L ${tabW} 1 L ${tabW} ${tabH}`;
  });

  readonly umlPackageTabHeight = computed(() =>
    Math.min(20, Math.round(this.shape().height * 0.2)),
  );

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
    if (this.isMasked()) {
      return;
    }
    this.shapeDoubleClick.emit(this.shape());
  }

  handlePullNote(event: MouseEvent): void {
    event.stopPropagation();
    this.pullStickyNote.emit(this.shape());
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
