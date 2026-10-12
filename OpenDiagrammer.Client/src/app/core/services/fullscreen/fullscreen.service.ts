import { Service, signal } from '@angular/core';

@Service()
export class FullscreenService {
  private readonly isFullscreenState = signal<boolean>(this.checkIsFullscreen());

  readonly isFullscreen = this.isFullscreenState.asReadonly();

  constructor() {
    if (typeof document !== 'undefined') {
      const updateState = () => {
        this.isFullscreenState.set(this.checkIsFullscreen());
      };

      document.addEventListener('fullscreenchange', updateState);
      document.addEventListener('webkitfullscreenchange', updateState);
    }
  }

  private checkIsFullscreen(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    const doc = document as unknown as {
      fullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
    };
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  }

  async toggleFullscreen(target?: HTMLElement): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }

    try {
      if (this.checkIsFullscreen()) {
        const doc = document as unknown as {
          exitFullscreen?: () => Promise<void>;
          webkitExitFullscreen?: () => Promise<void>;
        };
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        const element = (target ?? document.documentElement) as unknown as {
          requestFullscreen?: () => Promise<void>;
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        }
      }
    } catch {
      // Ignored if rejected (e.g. user gesture required or denied in iframe)
    } finally {
      this.isFullscreenState.set(this.checkIsFullscreen());
    }
  }
}
