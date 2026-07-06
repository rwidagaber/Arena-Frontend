import { Component, ElementRef, inject, signal, computed, effect, afterNextRender, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { GymService } from '../../../core/services/gym.service';
import { TranslationService } from '../../../core/services/translation.service';
import { WorkingHoursDay } from '../../../core/models/gym';

interface SocialLink {
  name: string;
  url: string;
  icon: string; // bootstrap-icons class suffix
}

interface HoursRow {
  startKey: string;        // i18n key for the first day in the range
  endKey: string | null;   // i18n key for the last day, or null for a single day
  time: string | null;     // formatted "8:00 AM – 3:00 AM", or null when closed
  isToday: boolean;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslateModule, RouterLink, RouterLinkActive],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css'],
  host: { '[class.reveal-in]': 'entered()' },
})
export class FooterComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private i18n = inject(TranslationService);
  private gym = inject(GymService);
  private host = inject(ElementRef<HTMLElement>);

  currentYear = new Date().getFullYear();

  /** Reads the reactive language signal so signal-based consumers (e.g. the
   *  `hoursRows` computed via `formatTime`) recompute when the user switches
   *  language at runtime, keeping the AM/PM markers localized. */
  get currentLang() {
    return this.i18n.currentLang() || this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  /* ── Contact details (same in both languages, so kept as data) ── */
  readonly phone = '+20 100 123 4567';
  readonly email = 'hello@arenagym.com';

  /** True when the user prefers reduced motion — gates all decorative motion. */
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /** Becomes true when the footer scrolls into view — drives the entrance
   *  transition (via the `reveal-in` host class) and the counter count-up. */
  protected readonly entered = signal(false);
  private revealObserver?: IntersectionObserver;

  constructor() {
    // Count the stats up the moment the footer first enters view.
    effect(() => {
      if (this.entered()) this.runStatsOnce();
    });
    // Browser-only: reveal once the footer scrolls into view.
    afterNextRender(() => this.observeReveal());
  }

  private observeReveal(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.entered.set(true);
      return;
    }
    this.revealObserver = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        this.entered.set(true);
        this.revealObserver?.disconnect();
      }
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    this.revealObserver.observe(this.host.nativeElement);
  }

  /* ── Newsletter signup ──────────────────────────────────────────── */
  /** Toggles the inline "subscribed" confirmation under the form. */
  protected readonly newsletterDone = signal(false);

  protected onNewsletterSubmit(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector('input');
    if (!input?.value) return;
    // TODO: wire to backend API
    input.value = '';
    this.newsletterDone.set(true);
    setTimeout(() => this.newsletterDone.set(false), 4000);
  }

  /* ── Animated stat counters ─────────────────────────────────────── */
  /** Flips true the instant the counters land, triggering the sheen sweep. */
  protected readonly statsCounted = signal(false);

  private animateStats(): void {
    const targets = this.stats.map(s => {
      const num = parseInt(s.value.replace(/[^0-9]/g, ''), 10);
      const suffix = s.value.replace(/[0-9,]/g, '');
      return { num, suffix, key: s.key };
    });
    const duration = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.displayStats.set(targets.map(t => ({
        key: t.key,
        value: Math.floor(eased * t.num).toLocaleString() + t.suffix
      })));
      if (progress < 1) requestAnimationFrame(tick);
      else this.statsCounted.set(true);
    };
    requestAnimationFrame(tick);
  }

  /* ── Counter count-up (runs once when the footer enters view) ── */
  private statsAnimated = false;

  private runStatsOnce(): void {
    if (this.statsAnimated) return;
    this.statsAnimated = true;
    if (this.reduceMotion) {
      // No animation — just show the final figures.
      this.displayStats.set(this.stats.map(s => ({ ...s })));
      this.statsCounted.set(true);
    } else {
      this.animateStats();
    }
  }

  /* ── Credibility stats strip (label keys live in footer.* i18n) ── */
  readonly stats: { value: string; key: string }[] = [
    { value: '10+',    key: 'statYears' },
    { value: '2,000+', key: 'statMembers' },
    { value: '30+',    key: 'statTrainers' },
    { value: '120+',   key: 'statClasses' },
  ];

  protected readonly displayStats = signal<{ value: string; key: string }[]>(
    this.stats.map(s => ({ ...s, value: '0' }))
  );

  /** Maps link for the "Get directions" action on the address. */
  get mapsUrl(): string {
    return 'https://www.google.com/maps/search/?api=1&query=ArenaGym';
  }

  /* ── Brand mantra (decorative marquee) ──────────────────────── */
  readonly mantra: readonly string[] = [
    'STRENGTH', 'DISCIPLINE', 'COMMUNITY', 'NEVER SETTLE', 'OWN IT', 'SHOW UP',
  ];

  /* ── Social links ───────────────────────────────────────────── */
  readonly socials: SocialLink[] = [
    { name: 'Instagram', url: 'https://instagram.com', icon: 'instagram' },
    { name: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
    { name: 'X', url: 'https://x.com', icon: 'twitter-x' },
    { name: 'YouTube', url: 'https://youtube.com', icon: 'youtube' },
    { name: 'Pinterest', url: 'https://pinterest.com', icon: 'pinterest' },
  ];

  /* ── Working hours from the DB (GET /api/working-hours) ──────────
     Logic mirrors the dedicated working-hours page so the footer
     stays consistent with it (after-midnight shifts, day mapping). */
  private schedule = signal<WorkingHoursDay[]>([]);

  /** Day-name lookup matching the working-hours feature (0 = Monday). */
  private getDayName(day: number | string): string {
    if (typeof day === 'number') {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[day] || '';
    }
    return day;
  }

  /** Display order Saturday → Friday, matching the working-hours page. */
  private readonly dayOrder: Record<string, number> = {
    Saturday: 0, Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6
  };

  ngOnInit(): void {
    // GymService falls back to sensible defaults if the request fails.
    this.gym.getWorkingHours().subscribe(data => this.schedule.set(data ?? []));
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
  }

  private todayName(): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[new Date().getDay()];
  }

  /** Hours rows for the footer: consecutive days that share the same hours are
   *  merged into a single range (e.g. "Sat – Wed") so the list stays compact. */
  readonly hoursRows = computed<HoursRow[]>(() => {
    const today = this.todayName();
    const byName = new Map<string, WorkingHoursDay>();
    for (const item of this.schedule()) {
      byName.set(this.getDayName(item.dayOfWeek), item);
    }

    // Display order Saturday → Friday, matching the working-hours page.
    const order = Object.keys(this.dayOrder).sort((a, b) => this.dayOrder[a] - this.dayOrder[b]);
    const sig = (i: WorkingHoursDay) => (i.isClosed ? 'closed' : `${i.openTime}|${i.closeTime}`);

    const rows: HoursRow[] = [];
    let group: { start: string; end: string; item: WorkingHoursDay; days: string[] } | null = null;

    const flush = () => {
      if (!group) return;
      rows.push({
        startKey: `workingHours.days.${group.start}`,
        endKey: group.start === group.end ? null : `workingHours.days.${group.end}`,
        time: group.item.isClosed
          ? null
          : `${this.formatTime(group.item.openTime)} – ${this.formatTime(group.item.closeTime)}`,
        isToday: group.days.includes(today),
      });
      group = null;
    };

    for (const name of order) {
      const item = byName.get(name);
      if (!item) continue;
      if (group && sig(group.item) === sig(item)) {
        group.end = name;
        group.days.push(name);
      } else {
        flush();
        group = { start: name, end: name, item, days: [name] };
      }
    }
    flush();
    return rows;
  });

  /** Live "open now" badge, accounting for shifts that cross midnight. */
  get isOpenNow(): boolean {
    const list = this.schedule();
    if (!list.length) return false;

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIdx = now.getDay();
    const todayName = dayNames[todayIdx];
    const yesterdayName = dayNames[(todayIdx - 1 + 7) % 7];

    const byName = (n: string) => list.find(i => this.getDayName(i.dayOfWeek) === n);
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Yesterday's shift may still be running if it crossed midnight.
    const yesterday = byName(yesterdayName);
    if (yesterday && !yesterday.isClosed && yesterday.openTime && yesterday.closeTime) {
      const o = toMin(yesterday.openTime), c = toMin(yesterday.closeTime);
      if (c < o && cur < c) return true;
    }

    // Today's shift.
    const today = byName(todayName);
    if (today && !today.isClosed && today.openTime && today.closeTime) {
      const o = toMin(today.openTime), c = toMin(today.closeTime);
      if (c < o) return cur >= o || cur < c; // crosses midnight
      return cur >= o && cur < c;            // same-day shift
    }

    return false;
  }

  /** "08:00:00" → "8:00 AM" (localized AM/PM marker for Arabic). */
  private formatTime(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const isAr = this.currentLang === 'ar';
    const ampm = hours >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');

    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }
}
