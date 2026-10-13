import { Service, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BoardRealtimeService } from '../realtime/board-realtime.service';

export type NetworkConnectionStatus = 'online' | 'offline' | 'reconnecting';

@Service()
export class NetworkStatusService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly realtimeService = inject(BoardRealtimeService);

  public readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  public readonly status = computed<NetworkConnectionStatus>(() => {
    if (!this.isOnline()) {
      return 'offline';
    }

    const realtimeState = this.realtimeService.connectionState();
    if (realtimeState === 'reconnecting' || realtimeState === 'connecting') {
      return 'reconnecting';
    }

    return 'online';
  });

  constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.snackBar.open('You are back online. Synchronizing board changes...', 'Dismiss', {
        duration: 4000,
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.snackBar.open(
        'You are offline. Changes are saved locally and will sync when you reconnect.',
        'Dismiss',
        {
          duration: 5000,
        },
      );
    });
  }
}
