import { TestBed } from '@angular/core/testing';
import { FullscreenService } from './fullscreen.service';

describe('FullscreenService', () => {
  let service: FullscreenService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FullscreenService],
    });
    service = TestBed.inject(FullscreenService);
  });

  it('should be created and default to not fullscreen', () => {
    expect(service).toBeTruthy();
    expect(service.isFullscreen()).toBe(false);
  });

  it('should update fullscreen state on fullscreenchange event', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });

    document.dispatchEvent(new Event('fullscreenchange'));
    expect(service.isFullscreen()).toBe(true);

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });

    document.dispatchEvent(new Event('fullscreenchange'));
    expect(service.isFullscreen()).toBe(false);
  });

  it('should request and exit fullscreen cleanly during toggle', async () => {
    const requestSpy = vi.fn().mockResolvedValue(undefined);
    const exitSpy = vi.fn().mockResolvedValue(undefined);

    document.documentElement.requestFullscreen = requestSpy;
    document.exitFullscreen = exitSpy;

    // Toggle on
    await service.toggleFullscreen();
    expect(requestSpy).toHaveBeenCalled();

    // Simulate entering fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(service.isFullscreen()).toBe(true);

    // Toggle off
    await service.toggleFullscreen();
    expect(exitSpy).toHaveBeenCalled();
  });
});
