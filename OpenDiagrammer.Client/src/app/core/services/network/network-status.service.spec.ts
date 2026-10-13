import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { BoardRealtimeService, RealtimeConnectionState } from '../realtime/board-realtime.service';

describe('NetworkStatusService', () => {
  let service: NetworkStatusService;
  let snackBarMock: { open: ReturnType<typeof vi.fn> };
  const realtimeStateSignal = signal<RealtimeConnectionState>('connected');

  beforeEach(() => {
    snackBarMock = {
      open: vi.fn(),
    };

    const realtimeMock = {
      connectionState: realtimeStateSignal,
    };

    TestBed.configureTestingModule({
      providers: [
        NetworkStatusService,
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: BoardRealtimeService, useValue: realtimeMock },
      ],
    });

    service = TestBed.inject(NetworkStatusService);
  });

  it('should be created and report initial online status', () => {
    expect(service).toBeTruthy();
    expect(service.isOnline()).toBe(true);
    expect(service.status()).toBe('online');
  });

  it('should react to offline event', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
    expect(service.status()).toBe('offline');
    expect(snackBarMock.open).toHaveBeenCalledWith(
      expect.stringContaining('You are offline'),
      'Dismiss',
      expect.any(Object),
    );
  });

  it('should react to online event', () => {
    // First trigger offline
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);

    // Then trigger online
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
    expect(service.status()).toBe('online');
    expect(snackBarMock.open).toHaveBeenCalledWith(
      expect.stringContaining('You are back online'),
      'Dismiss',
      expect.any(Object),
    );
  });

  it('should report reconnecting when realtime service is reconnecting', () => {
    realtimeStateSignal.set('reconnecting');
    expect(service.status()).toBe('reconnecting');

    realtimeStateSignal.set('connected');
    expect(service.status()).toBe('online');
  });
});
