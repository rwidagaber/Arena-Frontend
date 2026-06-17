import { Component, OnInit, OnDestroy, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of, Subscription } from 'rxjs';

import { QrService } from '../../../features/QR/qr.service';
import { BookingDto } from '../../../features/QR/qr.model';
import { BookingCalendarComponent } from '../booking-calendar/booking-calendar';
import { BookingCardComponent } from '../booking-card/booking-card';
import { StatsOverview, StatItem } from '../stats-overview/stats-overview';
import { AuthService } from '../../../core/services/auth';
import { ThemeService } from '../../../core/services/themeservice';

@Component({
  selector: 'app-booking-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BookingCalendarComponent,
    BookingCardComponent,
    StatsOverview,
  ],
  templateUrl: './booking-section.html',
  styleUrl: './booking-section.css',
})
export class BookingSection implements OnInit, OnDestroy {
  private qrService = inject(QrService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  /** The member-profile id used to fetch bookings */
  memberProfileId = input.required<string>();

  /** Emitted when the user cancels a booking so the parent can react if needed */
  bookingCancelled = output<string>();

  // ── State ──────────────────────────────────────────────────────────
  bookings = signal<BookingDto[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  upcomingExpanded = signal(true);
  pastExpanded = signal(false);

  // ── Slideshow State ────────────────────────────────────────────────
  activeSlideIndex = signal(0);
  /** Reactive dark-mode flag updated by MutationObserver on data-theme */
  private readonly isDark = signal<boolean>(this.themeService.isDark);
  private slideTimerId: any;
  private authSub: Subscription | null = null;
  private themeObserver: MutationObserver | null = null;
  userName = signal('');

  readonly darkSlides = [
    { image: 'assets/images/dashboard/bookings/dark-1.webp', quoteKey: 'bookingHeroSubtitle1' },
    { image: 'assets/images/dashboard/bookings/dark-2.webp', quoteKey: 'bookingHeroSubtitle2' },
    { image: 'assets/images/dashboard/bookings/dark-3.webp', quoteKey: 'bookingHeroSubtitle3' },
    { image: 'assets/images/dashboard/bookings/dark-4.webp', quoteKey: 'bookingHeroSubtitle4' },
    { image: 'assets/images/dashboard/bookings/dark-5.webp', quoteKey: 'bookingHeroSubtitle5' },
  ];

  readonly lightSlides = [
    { image: 'assets/images/dashboard/bookings/light-1.webp', quoteKey: 'bookingHeroSubtitleLight1' },
    { image: 'assets/images/dashboard/bookings/light-2.webp', quoteKey: 'bookingHeroSubtitleLight2' },
    { image: 'assets/images/dashboard/bookings/light-3.webp', quoteKey: 'bookingHeroSubtitleLight3' },
    { image: 'assets/images/dashboard/bookings/light-4.webp', quoteKey: 'bookingHeroSubtitleLight4' },
    { image: 'assets/images/dashboard/bookings/light-5.webp', quoteKey: 'bookingHeroSubtitleLight5' },
  ];

  currentSlides = computed(() => {
    return this.isDark() ? this.darkSlides : this.lightSlides;
  });

  currentSlide = computed(() => {
    return this.currentSlides()[this.activeSlideIndex()];
  });

  // ── Derived ────────────────────────────────────────────────────────
  upcomingBookings = computed(() => {
    const now = Date.now();
    return this.bookings().filter(b => {
      const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
      if (!isConfirmed) return false;
      try {
        const bDateTime = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`);
        return bDateTime.getTime() > now;
      } catch {
        return true;
      }
    });
  });

  pastBookings = computed(() => {
    const now = Date.now();
    return this.bookings().filter(b => {
      const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
      if (!isConfirmed) return true;
      try {
        const bDateTime = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`);
        return bDateTime.getTime() <= now;
      } catch {
        return false;
      }
    });
  });

  bookingStats = computed<StatItem[]>(() => [
    {
      label: 'totalBookings',
      value: this.bookings().length.toString(),
      icon: 'fas fa-calendar-check',
    },
    {
      label: 'upcoming',
      value: this.upcomingBookings().length.toString(),
      icon: 'fas fa-clock',
    },
    {
      label: 'past',
      value: this.pastBookings().length.toString(),
      icon: 'fas fa-history',
    },
  ]);

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadBookings();
    this.authSub = this.authService.currentUser$.subscribe(user => {
      this.userName.set(user?.firstName || '');
    });
    // Watch data-theme attribute changes to reactively swap slide arrays
    this.themeObserver = new MutationObserver(() => {
      const newIsDark = document.documentElement.getAttribute('data-theme') !== 'light';
      if (this.isDark() !== newIsDark) {
        this.isDark.set(newIsDark);
        this.activeSlideIndex.set(0); // reset to slide 1 on theme switch
      }
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.startSlideshow();
  }

  ngOnDestroy(): void {
    if (this.slideTimerId) {
      clearInterval(this.slideTimerId);
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

  // ── Actions ────────────────────────────────────────────────────────
  startSlideshow(): void {
    this.slideTimerId = setInterval(() => {
      this.activeSlideIndex.update(idx => (idx + 1) % 5);
    }, 4000);
  }

  toggleUpcoming(): void {
    this.upcomingExpanded.set(!this.upcomingExpanded());
  }

  togglePast(): void {
    this.pastExpanded.set(!this.pastExpanded());
  }

  loadBookings(): void {
    const id = this.memberProfileId();
    if (!id) return;

    this.loading.set(true);
    this.error.set(null);

    this.qrService
      .getBookings(id)
      .pipe(
        catchError(() => {
          this.error.set('error');
          return of([] as BookingDto[]);
        })
      )
      .subscribe(data => {
        this.bookings.set(data ?? []);
        this.loading.set(false);
      });
  }

  onCancelBooking(bookingId: string): void {
    this.qrService
      .cancelBooking(bookingId)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res) {
          this.loadBookings();
          this.bookingCancelled.emit(bookingId);
        }
      });
  }
}
