import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<'light' | 'dark' | 'system'>('system');

  constructor() {
    const saved = localStorage.getItem('arena_theme') as 'light' | 'dark' | 'system' | null;
    this.setTheme(saved ?? 'system');

    // ✅ لو system → تابع تغييرات الـ browser تلقائياً
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (this._theme() === 'system') {
          this._applyTheme('system');
        }
      });
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this._theme.set(theme);
    localStorage.setItem('arena_theme', theme);
    this._applyTheme(theme);
  }

  private _applyTheme(theme: 'light' | 'dark' | 'system'): void {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // الـ theme المحفوظ (light / dark / system)
  get current() { return this._theme(); }

  // ✅ للـ checkbox — هل الـ effective theme دارك فعلاً؟
  get isDark(): boolean {
    if (this._theme() === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return this._theme() === 'dark';
  }
}