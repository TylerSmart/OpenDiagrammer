import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BoardService } from './board.service';
import { BoardBackgroundType, BoardMode, BoardRole } from '../../models/board.models';

describe('BoardService', () => {
  let service: BoardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BoardService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BoardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get all boards', () => {
    const mockBoards = [
      {
        id: 'b1',
        name: 'Board 1',
        description: null,
        ownerId: 'u1',
        ownerUsername: 'owner',
        userRole: BoardRole.Owner,
        backgroundType: BoardBackgroundType.GridLines,
        backgroundColor: '#ffffff',
        backgroundOpacity: 1,
        mode: BoardMode.Normal,
        memberCount: 1,
        createdAt: '2026-10-10T00:00:00Z',
        modifiedAt: '2026-10-10T00:00:00Z',
      },
    ];

    service.getBoards().subscribe((boards) => {
      expect(boards).toEqual(mockBoards);
    });

    const req = httpMock.expectOne('/api/boards');
    expect(req.request.method).toBe('GET');
    req.flush(mockBoards);
  });

  it('should get board by id', () => {
    const mockBoard = {
      id: 'b1',
      name: 'Board 1',
      description: null,
      ownerId: 'u1',
      ownerUsername: 'owner',
      userRole: BoardRole.Owner,
      backgroundType: BoardBackgroundType.GridLines,
      backgroundColor: '#ffffff',
      backgroundOpacity: 1,
      mode: BoardMode.Normal,
      thinkModeConfigJson: null,
      createdAt: '2026-10-10T00:00:00Z',
      modifiedAt: '2026-10-10T00:00:00Z',
      members: [],
    };

    service.getBoardById('b1').subscribe((board) => {
      expect(board).toEqual(mockBoard);
    });

    const req = httpMock.expectOne('/api/boards/b1');
    expect(req.request.method).toBe('GET');
    req.flush(mockBoard);
  });

  it('should create board', () => {
    const createReq = {
      name: 'New Board',
      description: 'Desc',
      backgroundType: BoardBackgroundType.GridDots,
      backgroundColor: '#ffffff',
      backgroundOpacity: 1,
    };

    service.createBoard(createReq).subscribe((board) => {
      expect(board.name).toBe('New Board');
    });

    const req = httpMock.expectOne('/api/boards');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createReq);
    req.flush({ id: 'b2', ...createReq, members: [] });
  });

  it('should delete board', () => {
    service.deleteBoard('b1').subscribe();

    const req = httpMock.expectOne('/api/boards/b1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should get members of board', () => {
    service.getMembers('b1').subscribe((members) => {
      expect(members.length).toBe(1);
    });

    const req = httpMock.expectOne('/api/boards/b1/members');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'm1',
        boardId: 'b1',
        userId: 'u1',
        username: 'user1',
        email: 'u1@example.com',
        role: BoardRole.Owner,
        createdAt: '2026-10-10T00:00:00Z',
      },
    ]);
  });
});
