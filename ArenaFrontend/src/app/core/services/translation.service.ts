import { Injectable, signal } from '@angular/core';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

export type Lang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly storageKey = 'arena_lang';
  private translations: Record<string, any> = { en, ar };

  currentLang = signal<Lang>(this.loadLang());

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
  
  console.log('Translating:', key, '| Lang:', this.currentLang(), '| Found:', value);

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
