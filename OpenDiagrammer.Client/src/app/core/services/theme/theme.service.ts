import { Service, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'open-diagrammer-theme';

@Service()
export class ThemeService {
  private readonly mediaQuery: MediaQueryList | null =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  private readonly systemDarkState = signal<boolean>(this.mediaQuery?.matches ?? false);

  private readonly modeState = signal<ThemeMode>(this.readStoredMode());

  readonly mode = this.modeState.asReadonly();
  readonly systemDark = this.systemDarkState.asReadonly();

  readonly effectiveTheme = computed<ResolvedTheme>(() => {
    const currentMode = this.modeState();
    if (currentMode === 'system') {
      return this.systemDarkState() ? 'dark' : 'light';
    }
    return currentMode;
  });

  readonly isDark = computed<boolean>(() => this.effectiveTheme() === 'dark');

  constructor() {
    if (this.mediaQuery) {
      this.mediaQuery.addEventListener('change', (event: MediaQueryListEvent) => {
        this.systemDarkState.set(event.matches);
        if (this.modeState() === 'system') {
          this.applyTheme(this.effectiveTheme());
        }
      });
    }

    this.applyMode(this.modeState());
  }

  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    this.applyMode(mode);
  }

  private readStoredMode(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }

  private applyMode(mode: ThemeMode): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      this.applyTheme(this.effectiveTheme());
    }
  }

  private applyTheme(theme: ResolvedTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = theme;
    }
  }
}
