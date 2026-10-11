import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthProviderDto } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth/auth.service';
import { ThemeMode, ThemeService } from '../../core/services/theme/theme.service';

const THEME_ICONS: Record<ThemeMode, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'brightness_auto',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
};

@Component({
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  selector: 'app-login',
  styleUrl: './login.component.scss',
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly selectedTabIndex = signal<number>(0);
  protected readonly hideLoginPassword = signal<boolean>(true);
  protected readonly hideRegisterPassword = signal<boolean>(true);
  protected readonly hideConfirmPassword = signal<boolean>(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly providers = signal<AuthProviderDto[]>([]);

  protected readonly themeIcon = computed(() => THEME_ICONS[this.themeService.mode()]);
  protected readonly themeLabel = computed(() => THEME_LABELS[this.themeService.mode()]);

  protected readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly registerForm = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] },
  );

  ngOnInit(): void {
    this.authService.getProviders().subscribe({
      next: (list) => this.providers.set(list),
      error: () => undefined,
    });
  }

  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    this.errorMessage.set(null);
  }

  onLoginSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const formVal = this.loginForm.getRawValue();

    this.authService.login(formVal).subscribe({
      next: () => {
        this.snackBar.open('Signed in successfully', 'Close', {
          duration: 3000,
        });
        this.navigateToTarget();
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.extractErrorMessage(err, 'Invalid email or password.'));
      },
    });
  }

  onRegisterSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const formVal = this.registerForm.getRawValue();

    this.authService
      .register({
        email: formVal.email,
        username: formVal.username,
        password: formVal.password,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Account created successfully!', 'Close', {
            duration: 3000,
          });
          this.navigateToTarget();
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            this.extractErrorMessage(err, 'Could not create account. Please check your details.'),
          );
        },
      });
  }

  onExternalLogin(provider: AuthProviderDto): void {
    if (provider.authorizationUrl) {
      window.location.href = provider.authorizationUrl;
    }
  }

  private navigateToTarget(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error?.detail) {
        return err.error.detail;
      }
      if (err.error?.title) {
        return err.error.title;
      }
      if (typeof err.error === 'string') {
        return err.error;
      }
    }
    return fallback;
  }
}
