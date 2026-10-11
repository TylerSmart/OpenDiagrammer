import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth/auth.service';
import { ThemeService } from '../../core/services/theme/theme.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: {
    isLoading: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    getProviders: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAuthService = {
      isLoading: vi.fn().mockReturnValue(false),
      login: vi.fn().mockReturnValue(
        of({
          token: 'token123',
          id: 'u1',
          email: 'test@example.com',
          username: 'testuser',
          expiresAt: '2026-10-11T00:00:00Z',
        }),
      ),
      register: vi.fn().mockReturnValue(
        of({
          token: 'token123',
          id: 'u1',
          email: 'test@example.com',
          username: 'testuser',
          expiresAt: '2026-10-11T00:00:00Z',
        }),
      ),
      getProviders: vi.fn().mockReturnValue(of([])),
    };

    mockRouter = {
      navigateByUrl: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { returnUrl: '/dashboard' },
            },
          },
        },
        ThemeService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid login form when empty', () => {
    expect(component['loginForm'].valid).toBe(false);
  });

  it('should submit login when valid', () => {
    component['loginForm'].setValue({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(component['loginForm'].valid).toBe(true);

    component.onLoginSubmit();
    expect(mockAuthService.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('should display error message on failed login', () => {
    mockAuthService.login.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { detail: 'Invalid credentials provided' },
          }),
      ),
    );

    component['loginForm'].setValue({
      email: 'wrong@example.com',
      password: 'wrongpassword',
    });
    component.onLoginSubmit();

    expect(component['errorMessage']()).toBe('Invalid credentials provided');
  });

  it('should validate matching passwords in register form', () => {
    component['registerForm'].patchValue({
      username: 'tester',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'differentpassword',
    });
    expect(component['registerForm'].hasError('passwordMismatch')).toBe(true);

    component['registerForm'].patchValue({
      confirmPassword: 'password123',
    });
    expect(component['registerForm'].hasError('passwordMismatch')).toBe(false);
    expect(component['registerForm'].valid).toBe(true);
  });

  it('should submit register form and navigate', () => {
    component['registerForm'].setValue({
      username: 'newuser',
      email: 'new@example.com',
      password: 'secretpassword',
      confirmPassword: 'secretpassword',
    });

    component.onRegisterSubmit();
    expect(mockAuthService.register).toHaveBeenCalledWith({
      username: 'newuser',
      email: 'new@example.com',
      password: 'secretpassword',
    });
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
