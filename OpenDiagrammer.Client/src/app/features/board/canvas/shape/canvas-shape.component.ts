import { Component, computed, input, output, signal } from '@angular/core';
import { AnchorPosition } from '../connection.models';
import { CanvasShape } from '../shape.models';

@Component({
  selector: 'app-canvas-shape',
  templateUrl: './canvas-shape.component.html',
  styleUrl: './canvas-shape.component.scss',
})
export class CanvasShapeComponent {
  readonly shape = input.required<CanvasShape>();
  readonly isSelected = input<boolean>(false);
  readonly showAnchors = input<boolean>(false);
  readonly allowHoverAnchors = input<boolean>(true);

  readonly isHovered = signal<boolean>(false);

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
