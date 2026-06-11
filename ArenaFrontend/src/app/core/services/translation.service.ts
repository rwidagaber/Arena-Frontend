import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly storageKey = 'arena_lang';
  private ngxTranslate = inject(TranslateService);

  currentLang = signal<Lang>(this.loadLang());

  constructor() {
    this.ngxTranslate.use(this.currentLang());
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
    this.ngxTranslate.use(lang);
  }

  translate(key: string, params?: Record<string, string | number>): string {
    return this.ngxTranslate.instant(key, params) || key;
  }
}
