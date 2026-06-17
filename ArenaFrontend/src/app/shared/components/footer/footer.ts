import { Component, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

interface SocialLink {
  name: string;
  url: string;
  icon: string; // bootstrap-icons class suffix
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslateModule, FormsModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  private translate = inject(TranslateService);
  currentYear = new Date().getFullYear();

  get currentLang() {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  /* ── Newsletter (local-only, no backend wiring) ─────────────── */
  newsletterEmail = '';
  subscribed = false;
  emailError = false;

  subscribe(): void {
    const email = this.newsletterEmail.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      this.emailError = true;
      this.subscribed = false;
      return;
    }
    this.emailError = false;
    this.subscribed = true;
    this.newsletterEmail = '';
  }

  /* ── Back-to-top ────────────────────────────────────────────── */
  showTopButton = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.showTopButton = window.scrollY > 400;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Live "open now" badge based on working hours ───────────── */
  get isOpenNow(): boolean {
    const now = new Date();
    const day = now.getDay(); // 0 = Sun, 6 = Sat
    const h = now.getHours() + now.getMinutes() / 60;
    if (day === 0) return false;            // Sunday closed
    if (day === 6) return h >= 7 && h < 21; // Saturday 7:00 - 21:00
    return h >= 6 && h < 22.5;              // Weekdays 6:00 - 22:30
  }

  /* ── Social links ───────────────────────────────────────────── */
  readonly socials: SocialLink[] = [
    { name: 'Instagram', url: 'https://instagram.com', icon: 'instagram' },
    { name: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
    { name: 'X', url: 'https://x.com', icon: 'twitter-x' },
    { name: 'YouTube', url: 'https://youtube.com', icon: 'youtube' },
    { name: 'Pinterest', url: 'https://pinterest.com', icon: 'pinterest' },
  ];

  /* ── Bilingual micro-copy for the newly added UI pieces.
        Kept in-component so no shared i18n files are touched. ───── */
  private readonly copy: Record<string, { en: string; ar: string }> = {
    newsletterTitle:  { en: 'Join the Arena', ar: 'انضم إلى الأرينا' },
    newsletterSub:    { en: 'Get training tips, member offers, and class updates — straight to your inbox.', ar: 'احصل على نصائح التمارين وعروض الأعضاء وتحديثات الحصص مباشرةً إلى بريدك.' },
    emailPlaceholder: { en: 'Enter your email', ar: 'أدخل بريدك الإلكتروني' },
    subscribe:        { en: 'Subscribe', ar: 'اشترك' },
    subscribedMsg:    { en: "You're in! Welcome to the Arena.", ar: 'تم الاشتراك! أهلاً بك في الأرينا.' },
    emailErrorMsg:    { en: 'Please enter a valid email address.', ar: 'يرجى إدخال بريد إلكتروني صحيح.' },
    phone:            { en: '+20 100 123 4567', ar: '+20 100 123 4567' },
    email:            { en: 'hello@arenagym.com', ar: 'hello@arenagym.com' },
    followUs:         { en: 'Follow us', ar: 'تابعنا' },
    openNow:          { en: 'Open now', ar: 'مفتوح الآن' },
    closedNow:        { en: 'Closed now', ar: 'مغلق الآن' },
    privacy:          { en: 'Privacy Policy', ar: 'سياسة الخصوصية' },
    terms:            { en: 'Terms of Service', ar: 'شروط الخدمة' },
    backToTop:        { en: 'Back to top', ar: 'العودة للأعلى' },
    madeWith:         { en: 'Crafted for athletes', ar: 'صُنع للرياضيين' },
  };

  tr(key: string): string {
    const entry = this.copy[key];
    if (!entry) return key;
    return this.currentLang === 'ar' ? entry.ar : entry.en;
  }
}
