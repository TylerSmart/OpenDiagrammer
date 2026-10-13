import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BoardRealtimeService } from './board-realtime.service';
import { AuthService } from '../auth/auth.service';
import { CrdtService } from '../crdt/crdt.service';

describe('BoardRealtimeService', () => {
  let service: BoardRealtimeService;

  beforeEach(() => {
    const authMock = {
      token: () => 'mock-jwt-token',
    };

    const crdtMock = {
      applyRemoteUpdate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        BoardRealtimeService,
        { provide: AuthService, useValue: authMock },
        { provide: CrdtService, useValue: crdtMock },
      ],
    });

    service = TestBed.inject(BoardRealtimeService);
  });

  it('should be created with initial disconnected state', () => {
    expect(service).toBeTruthy();
    expect(service.connectionState()).toBe('disconnected');
    expect(service.presences()).toEqual([]);
    expect(service.otherUsersCursors()).toEqual({});
  });

  it('should safely handle sendCrdtUpdate when disconnected', async () => {
    await expect(service.sendCrdtUpdate(new Uint8Array([1, 2, 3]))).resolves.not.toThrow();
  });

  it('should safely handle sendCursor when disconnected', async () => {
    await expect(service.sendCursor(100, 200)).resolves.not.toThrow();
  });

  it('should reset state on stopConnection', async () => {
    service.presences.set([
      {
        userId: 'u1',
        username: 'User 1',
        color: '#ff0000',
        role: 0,
      },
    ]);
    service.otherUsersCursors.set({
      u1: {
        userId: 'u1',
        username: 'User 1',
        color: '#ff0000',
        x: 10,
        y: 20,
      },
    });

    await service.stopConnection();

    expect(service.connectionState()).toBe('disconnected');
    expect(service.presences()).toEqual([]);
    expect(service.otherUsersCursors()).toEqual({});
  });
});
