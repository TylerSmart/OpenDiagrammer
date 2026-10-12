import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should initialize with system mode when no preference stored', () => {
    expect(service.mode()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
  });

  it('should update mode and persist to localStorage on setMode', () => {
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
    expect(localStorage.getItem('open-diagrammer-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
    expect(service.isDark()).toBe(true);

    service.setMode('light');
    expect(service.mode()).toBe('light');
    expect(localStorage.getItem('open-diagrammer-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(service.effectiveTheme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('should restore stored mode from localStorage', () => {
    localStorage.setItem('open-diagrammer-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    const restoredService = TestBed.inject(ThemeService);
    expect(restoredService.mode()).toBe('dark');
    expect(restoredService.effectiveTheme()).toBe('dark');
  });
});
