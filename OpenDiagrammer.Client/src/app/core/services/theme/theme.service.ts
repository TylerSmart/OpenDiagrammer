import { Service, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'open-diagrammer-theme';

@Service()
export class ThemeService {
  private readonly modeState = signal<ThemeMode>(this.readStoredMode());

  readonly mode = this.modeState.asReadonly();

  constructor() {
    this.applyMode(this.modeState());
  }

  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.applyMode(mode);
  }

  private readStoredMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }

  private applyMode(mode: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
