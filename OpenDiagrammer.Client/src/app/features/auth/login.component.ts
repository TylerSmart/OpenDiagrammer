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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
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
    MatProgressSpinnerModule,
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
  protected readonly isProcessingOAuth = signal<boolean>(false);

  protected readonly externalProviders = computed(() =>
    this.providers().filter((p) => p.isExternal),
  );

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
    this.checkExternalAuthCallback();

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
    this.errorMessage.set(null);
    const authUrl = this.buildAuthorizationUrl(provider);

    if (!authUrl) {
      this.errorMessage.set(
        `Unable to sign in with ${provider.name}: OAuth authorization endpoint or client ID is not configured.`,
      );
      return;
    }

    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('oauth_return_url', returnUrl);
    }

    window.location.href = authUrl;
  }

  protected getProviderIcon(provider: AuthProviderDto): string {
    const name = provider.name.toLowerCase();
    if (name.includes('google')) {
      return 'account_circle';
    }
    if (name.includes('microsoft')) {
      return 'window';
    }
    if (name.includes('github')) {
      return 'code';
    }
    return 'login';
  }

  private buildAuthorizationUrl(provider: AuthProviderDto): string | null {
    if (provider.authorizationUrl && provider.authorizationUrl.includes('?')) {
      return provider.authorizationUrl;
    }

    const config = provider.oidcConfig;
    let endpoint = config?.authorizationEndpoint || provider.authorizationUrl;

    if (!endpoint && config?.authority) {
      const authority = config.authority.replace(/\/$/, '');
      if (authority.toLowerCase().includes('accounts.google.com')) {
        endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      } else {
        endpoint = `${authority}/authorize`;
      }
    }

    // Google authority fallback when authority was set to accounts.google.com without custom endpoint
    if (endpoint && endpoint.includes('accounts.google.com') && endpoint.endsWith('/authorize')) {
      endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    }

    const clientId = config?.clientId;
    if (!endpoint || !clientId) {
      return null;
    }

    try {
      const redirectUri =
        typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : 'http://localhost:4200/login';
      const url = new URL(endpoint);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config?.scope || 'openid profile email');
      url.searchParams.set('state', 'oidc');
      url.searchParams.set('prompt', 'select_account');

      return url.toString();
    } catch {
      return null;
    }
  }

  private checkExternalAuthCallback(): void {
    const queryParams = this.route.snapshot.queryParams;
    const code = queryParams['code'];
    const error = queryParams['error'];
    const errorDescription = queryParams['error_description'];

    const hashParams =
      typeof window !== 'undefined' && window.location.hash
        ? new URLSearchParams(window.location.hash.replace(/^#/, ''))
        : null;
    const idToken = queryParams['id_token'] || hashParams?.get('id_token') || null;
    const accessToken = queryParams['access_token'] || hashParams?.get('access_token') || null;

    if (error) {
      this.errorMessage.set(errorDescription || `External sign in failed: ${error}`);
      return;
    }

    if (code || idToken || accessToken) {
      this.isProcessingOAuth.set(true);
      const redirectUri =
        typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : 'http://localhost:4200/login';

      this.authService
        .externalCallback({
          code: code || null,
          idToken: idToken || null,
          accessToken: accessToken || null,
          redirectUri,
        })
        .subscribe({
          next: () => {
            this.isProcessingOAuth.set(false);
            this.snackBar.open('Signed in successfully', 'Close', {
              duration: 3000,
            });
            const returnUrl =
              typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('oauth_return_url') || '/dashboard'
                : '/dashboard';
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem('oauth_return_url');
            }
            this.router.navigateByUrl(returnUrl);
          },
          error: (err: unknown) => {
            this.isProcessingOAuth.set(false);
            this.errorMessage.set(
              this.extractErrorMessage(
                err,
                'Could not complete external sign in. Please try again.',
              ),
            );
          },
        });
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
