import { Component, computed, input } from '@angular/core';
import { CanvasShape } from '../shape.models';

@Component({
  selector: 'app-canvas-shape',
  templateUrl: './canvas-shape.component.html',
  styleUrl: './canvas-shape.component.scss',
})
export class CanvasShapeComponent {
  readonly shape = input.required<CanvasShape>();
  readonly isSelected = input<boolean>(false);

  readonly shapeStyles = computed(() => {
    const s = this.shape();
    return {
      transform: `translate(${s.x}px, ${s.y}px)`,
      width: `${s.width}px`,
      height: `${s.height}px`,
      zIndex: s.zIndex,
    };
  });

  readonly diamondPoints = computed(() => {
    const w = this.shape().width;
    const h = this.shape().height;
    return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
  });
}
