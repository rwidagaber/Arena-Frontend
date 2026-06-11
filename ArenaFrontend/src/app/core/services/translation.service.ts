import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Lang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly storageKey = 'arena_lang';
  private http = inject(HttpClient);
  private translations: Record<string, any> = { en: {}, ar: {} };

  currentLang = signal<Lang>(this.loadLang());

  constructor() {
    this.load('en');
    this.load('ar');
  }

  private async load(lang: Lang): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get(`./i18n/${lang}.json`)
      );
      this.translations[lang] = data;
    } catch {
      this.translations[lang] = {};
    }
  }

  private loadLang(): Lang {
    const stored = localStorage.getItem(this.storageKey) as Lang | null;
    if (stored === 'en' || stored === 'ar') return stored;
    return 'en';
  }

  switchLang(lang: Lang): void {
    this.currentLang.set(lang);
    localStorage.setItem(this.storageKey, lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLang()];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') return key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, String(v));
      }
    }

    return value;
  }
}
