import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import {
  BoardBackgroundType,
  BoardMode,
  BoardRole,
  BoardSummaryDto,
} from '../../core/models/board.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { BoardService } from '../../core/services/board/board.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockBoards: BoardSummaryDto[] = [
    {
      id: 'b-1',
      name: 'System Design',
      description: 'Microservices diagram',
      ownerId: 'u-1',
      ownerUsername: 'alice',
      userRole: BoardRole.Owner,
      backgroundType: BoardBackgroundType.GridLines,
      backgroundColor: '#ffffff',
      backgroundOpacity: 1,
      mode: BoardMode.Normal,
      memberCount: 2,
      createdAt: '2026-10-10T00:00:00Z',
      modifiedAt: '2026-10-10T00:00:00Z',
    },
    {
      id: 'b-2',
      name: 'User Flow',
      description: 'Signup and onboarding',
      ownerId: 'u-2',
      ownerUsername: 'bob',
      userRole: BoardRole.Editor,
      backgroundType: BoardBackgroundType.GridDots,
      backgroundColor: '#ffffff',
      backgroundOpacity: 1,
      mode: BoardMode.Normal,
      memberCount: 3,
      createdAt: '2026-10-10T00:00:00Z',
      modifiedAt: '2026-10-10T00:00:00Z',
    },
  ];

  let mockBoardService: {
    getBoards: ReturnType<typeof vi.fn>;
    createBoard: ReturnType<typeof vi.fn>;
    deleteBoard: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockBoardService = {
      getBoards: vi.fn().mockReturnValue(of(mockBoards)),
      createBoard: vi.fn().mockReturnValue(
        of({
          id: 'b-new',
          name: 'Brand New Board',
          description: null,
          ownerId: 'u-1',
          ownerUsername: 'alice',
          userRole: BoardRole.Owner,
          backgroundType: BoardBackgroundType.GridLines,
          backgroundColor: '#ffffff',
          backgroundOpacity: 1,
          mode: BoardMode.Normal,
          thinkModeConfigJson: null,
          createdAt: '2026-10-10T00:00:00Z',
          modifiedAt: '2026-10-10T00:00:00Z',
          members: [],
        }),
      ),
      deleteBoard: vi.fn().mockReturnValue(of(undefined)),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'u-1',
        email: 'alice@example.com',
        username: 'alice',
      }),
      logout: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: BoardService, useValue: mockBoardService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        ThemeService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load boards', () => {
    expect(component).toBeTruthy();
    expect(mockBoardService.getBoards).toHaveBeenCalled();
    expect(component['boards']().length).toBe(2);
  });

  it('should filter boards based on search query', () => {
    component['searchQuery'].set('System');
    expect(component['filteredBoards']().length).toBe(1);
    expect(component['filteredBoards']()[0].name).toBe('System Design');

    component['searchQuery'].set('onboarding');
    expect(component['filteredBoards']().length).toBe(1);
    expect(component['filteredBoards']()[0].name).toBe('User Flow');

    component['searchQuery'].set('nonexistent');
    expect(component['filteredBoards']().length).toBe(0);
  });

  it('should navigate to board on click', () => {
    component.navigateToBoard('b-1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/board', 'b-1']);
  });

  it('should call logout on AuthService', () => {
    component.onLogout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('should delete board when confirmed', () => {
    mockDialog.open.mockReturnValue({
      afterClosed: () => of(true),
    });

    component.deleteBoard(mockBoards[0]);

    expect(mockBoardService.deleteBoard).toHaveBeenCalledWith('b-1');
    expect(component['boards']().length).toBe(1);
    expect(mockSnackBar.open).toHaveBeenCalled();
  });
});
