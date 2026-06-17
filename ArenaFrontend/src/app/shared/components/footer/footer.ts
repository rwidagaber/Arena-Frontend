import { Component, inject, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

interface SocialLink {
  name: string;
  url: string;
  icon: string; // bootstrap-icons class suffix
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslateModule, RouterLink, RouterLinkActive],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  private translate = inject(TranslateService);
  currentYear = new Date().getFullYear();

  get currentLang() {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  /* ── Contact details (same in both languages, so kept as data) ── */
  readonly phone = '+20 100 123 4567';
  readonly email = 'hello@arenagym.com';

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

  /* ── Credibility stats strip (label keys live in footer.* i18n) ── */
  readonly stats: { value: string; key: string }[] = [
    { value: '10+',    key: 'statYears' },
    { value: '2,000+', key: 'statMembers' },
    { value: '30+',    key: 'statTrainers' },
    { value: '120+',   key: 'statClasses' },
  ];

  /** Maps link for the "Get directions" action on the address. */
  get mapsUrl(): string {
    return 'https://www.google.com/maps/search/?api=1&query=ArenaGym';
  }

  /* ── Social links ───────────────────────────────────────────── */
  readonly socials: SocialLink[] = [
    { name: 'Instagram', url: 'https://instagram.com', icon: 'instagram' },
    { name: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
    { name: 'X', url: 'https://x.com', icon: 'twitter-x' },
    { name: 'YouTube', url: 'https://youtube.com', icon: 'youtube' },
    { name: 'Pinterest', url: 'https://pinterest.com', icon: 'pinterest' },
  ];
}
