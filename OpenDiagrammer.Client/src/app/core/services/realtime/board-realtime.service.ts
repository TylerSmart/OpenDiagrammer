import { Service, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { apiUrl } from '../../api/api-url';
import { BoardSyncInitDto, CanvasCursorDto, UserPresenceDto } from '../../models/board.models';
import { AuthService } from '../auth/auth.service';
import { CrdtService, uint8ArrayToBase64, base64ToUint8Array } from '../crdt/crdt.service';

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

@Service()
export class BoardRealtimeService {
  private readonly authService = inject(AuthService);
  private readonly crdtService = inject(CrdtService);

  private hubConnection: signalR.HubConnection | null = null;
  private currentBoardId: string | null = null;

  public readonly connectionState = signal<RealtimeConnectionState>('disconnected');
  public readonly presences = signal<UserPresenceDto[]>([]);
  public readonly otherUsersCursors = signal<Record<string, CanvasCursorDto>>({});

  public async startConnection(boardId: string): Promise<BoardSyncInitDto | null> {
    if (this.currentBoardId === boardId && this.connectionState() === 'connected') {
      return null;
    }

    await this.stopConnection();

    this.currentBoardId = boardId;
    this.connectionState.set('connecting');

    let hubUrl = apiUrl('/hubs/board');
    if (!hubUrl.startsWith('http://') && !hubUrl.startsWith('https://')) {
      const rawOrigin =
        typeof window !== 'undefined' &&
        window.location?.origin &&
        window.location.origin !== 'null'
          ? window.location.origin
          : 'http://localhost';
      hubUrl = `${rawOrigin}${hubUrl.startsWith('/') ? '' : '/'}${hubUrl}`;
    }

    try {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => this.authService.token() ?? '',
        })
        .withAutomaticReconnect()
        .build();

      this.setupListeners();

      await this.hubConnection.start();
      this.connectionState.set('connected');

      const initData = await this.hubConnection.invoke<BoardSyncInitDto>('JoinBoard', boardId);
      this.presences.set(initData.presences);
      return initData;
    } catch {
      this.connectionState.set('disconnected');
      return null;
    }
  }

  private setupListeners(): void {
    if (!this.hubConnection) {
      return;
    }

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set('reconnecting');
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionState.set('connected');
      if (this.currentBoardId) {
        try {
          const initData = await this.hubConnection!.invoke<BoardSyncInitDto>(
            'JoinBoard',
            this.currentBoardId,
          );
          this.presences.set(initData.presences);
        } catch {
          // Reconnection rejoin handled
        }
      }
    });

    this.hubConnection.onclose(() => {
      this.connectionState.set('disconnected');
    });

    this.hubConnection.on('UserJoined', (user: UserPresenceDto) => {
      this.presences.update((list) => {
        const index = list.findIndex((u) => u.userId === user.userId);
        if (index >= 0) {
          const copy = [...list];
          copy[index] = user;
          return copy;
        }
        return [...list, user];
      });
    });

    this.hubConnection.on('UserLeft', (userId: string) => {
      this.presences.update((list) => list.filter((u) => u.userId !== userId));
      this.otherUsersCursors.update((cursors) => {
        const copy = { ...cursors };
        delete copy[userId];
        return copy;
      });
    });

    this.hubConnection.on('ReceiveCrdtUpdate', (updatePayload: string | number[]) => {
      let bytes: Uint8Array;
      if (typeof updatePayload === 'string') {
        bytes = base64ToUint8Array(updatePayload);
      } else if (Array.isArray(updatePayload)) {
        bytes = new Uint8Array(updatePayload);
      } else {
        return;
      }
      this.crdtService.applyRemoteUpdate(bytes);
    });

    this.hubConnection.on('ReceiveCursor', (cursor: CanvasCursorDto) => {
      this.otherUsersCursors.update((prev) => ({
        ...prev,
        [cursor.userId]: cursor,
      }));
    });

    this.hubConnection.on('ReceivePresenceUpdate', (user: UserPresenceDto) => {
      this.presences.update((list) => {
        const index = list.findIndex((u) => u.userId === user.userId);
        if (index >= 0) {
          const copy = [...list];
          copy[index] = user;
          return copy;
        }
        return [...list, user];
      });
    });
  }

  public async sendCrdtUpdate(update: Uint8Array): Promise<void> {
    if (!this.hubConnection || this.connectionState() !== 'connected' || !this.currentBoardId) {
      return;
    }

    try {
      // In SignalR .NET, byte[] is represented as a Base64 string in JSON protocol
      const base64 = uint8ArrayToBase64(update);
      await this.hubConnection.send('SendCrdtUpdate', this.currentBoardId, base64);
    } catch {
      // Silently handle send failure while offline
    }
  }

  public async sendCursor(x: number, y: number): Promise<void> {
    if (!this.hubConnection || this.connectionState() !== 'connected' || !this.currentBoardId) {
      return;
    }

    try {
      await this.hubConnection.send('SendCursor', this.currentBoardId, x, y);
    } catch {
      // Ignore cursor throttle failures
    }
  }

  public async updatePresence(isTyping: boolean, activeSelectionId?: string | null): Promise<void> {
    if (!this.hubConnection || this.connectionState() !== 'connected' || !this.currentBoardId) {
      return;
    }

    try {
      await this.hubConnection.invoke(
        'UpdatePresence',
        this.currentBoardId,
        isTyping,
        activeSelectionId ?? null,
      );
    } catch {
      // Silently ignore
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      if (this.currentBoardId && this.connectionState() === 'connected') {
        try {
          await this.hubConnection.invoke('LeaveBoard', this.currentBoardId);
        } catch {
          // Ignore leave failure during disconnect
        }
      }
      try {
        await this.hubConnection.stop();
      } catch {
        // Ignore stop error
      }
      this.hubConnection = null;
    }
    this.currentBoardId = null;
    this.connectionState.set('disconnected');
    this.presences.set([]);
    this.otherUsersCursors.set({});
  }
}
