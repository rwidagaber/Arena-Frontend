import { Component, OnInit, OnDestroy, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { catchError, of, Subscription } from 'rxjs';

import { BookingDto, BookingSource } from '../../../core/models/booking';
import { BookingService } from '../../../core/services/booking.service';
import { WorkingHoursService, WorkingHoursDto } from '../../../features/working-hours/working-hours.service';
import { BookingCalendarComponent } from '../booking-calendar/booking-calendar';
import { BookingCardComponent } from '../booking-card/booking-card';
import { StatsOverview, StatItem } from '../stats-overview/stats-overview';
import { AuthService } from '../../../core/services/auth';
import { BookingEventsService } from '../../../core/services/booking-events.service';
import { ThemeService } from '../../../core/services/themeservice';

@Component({
  selector: 'app-booking-section',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    BookingCalendarComponent,
    BookingCardComponent,
  ],
  templateUrl: './booking-section.html',
  styleUrl: './booking-section.css',
})
export class BookingSection implements OnInit, OnDestroy {
  private bookingService = inject(BookingService);
  private workingHoursService = inject(WorkingHoursService);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private bookingEvents = inject(BookingEventsService);
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

  // ── Pagination ─────────────────────────────────────────────────────
  readonly PAGE_SIZE = 6;
  upcomingPage = signal(1);
  pastPage     = signal(1);

  // ── Slideshow State ────────────────────────────────────────────────
  activeSlideIndex = signal(0);
  /** Reactive dark-mode flag updated by MutationObserver on data-theme */
  private readonly isDark = signal<boolean>(this.themeService.isDark);
  private slideTimerId: any;
  private authSub: Subscription | null = null;
  private bookingEventsSub: Subscription | null = null;
  private themeObserver: MutationObserver | null = null;
  private lastLoadedMemberProfileId = '';
  userName = signal('');

  constructor() {
    effect(() => {
      const id = this.memberProfileId();
      if (id && id !== this.lastLoadedMemberProfileId) {
        this.loadBookings();
      }
    });
  }

  /** Single stable array – dark slides at positions 0-4, light slides at 5-9.
   *  Never changes reference, so @for never tears down the DOM. */
  readonly allSlides = [
    // ── dark (index 0-4) ───────────────────────────────────────────────
    { image: 'assets/images/dashboard/bookings/dark-1.webp', quoteKey: 'bookingHeroSubtitle1' },
    { image: 'assets/images/dashboard/bookings/dark-2.webp', quoteKey: 'bookingHeroSubtitle2' },
    { image: 'assets/images/dashboard/bookings/dark-3.webp', quoteKey: 'bookingHeroSubtitle3' },
    { image: 'assets/images/dashboard/bookings/dark-4.webp', quoteKey: 'bookingHeroSubtitle4' },
    { image: 'assets/images/dashboard/bookings/dark-5.webp', quoteKey: 'bookingHeroSubtitle5' },
    // ── light (index 5-9) ──────────────────────────────────────────────
    { image: 'assets/images/dashboard/bookings/light-1.webp', quoteKey: 'bookingHeroSubtitleLight1' },
    { image: 'assets/images/dashboard/bookings/light-2.webp', quoteKey: 'bookingHeroSubtitleLight2' },
    { image: 'assets/images/dashboard/bookings/light-3.webp', quoteKey: 'bookingHeroSubtitleLight3' },
    { image: 'assets/images/dashboard/bookings/light-4.webp', quoteKey: 'bookingHeroSubtitleLight4' },
    { image: 'assets/images/dashboard/bookings/light-5.webp', quoteKey: 'bookingHeroSubtitleLight5' },
  ];

  /** Index inside allSlides that is currently active.
   *  Dark: activeSlideIndex() maps to 0-4.
   *  Light: activeSlideIndex() maps to 5-9. */
  readonly activeGlobalIndex = computed(() => {
    const offset = this.isDark() ? 0 : 5;
    return offset + this.activeSlideIndex();
  });

  /** The currently active slide object (for the quote binding). */
  readonly currentSlide = computed(() => this.allSlides[this.activeGlobalIndex()]);

  // ── Derived ────────────────────────────────────────────────────────
  private getBookingTime(b: BookingDto): number {
    try {
      const datePart = b.bookingDate.split('T')[0];
      const timePart = b.startTime || '00:00';
      return new Date(`${datePart}T${timePart}`).getTime();
    } catch {
      return 0;
    }
  }

  upcomingBookings = computed(() => {
    const now = Date.now();
    const filtered = this.bookings().filter(b => {
      const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
      if (!isConfirmed) return false;
      try {
        const bDateTime = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`);
        return bDateTime.getTime() > now;
      } catch {
        return true;
      }
    });
    return filtered.sort((a, b) => this.getBookingTime(b) - this.getBookingTime(a));
  });

  pastBookings = computed(() => {
    const now = Date.now();
    const filtered = this.bookings().filter(b => {
      const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
      if (!isConfirmed) return true;
      try {
        const bDateTime = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`);
        return bDateTime.getTime() <= now;
      } catch {
        return false;
      }
    });
    return filtered.sort((a, b) => this.getBookingTime(b) - this.getBookingTime(a));
  });

  // ── Paginated slices ───────────────────────────────────────────────
  upcomingPageCount = computed(() =>
    Math.max(1, Math.ceil(this.upcomingBookings().length / this.PAGE_SIZE))
  );
  pastPageCount = computed(() =>
    Math.max(1, Math.ceil(this.pastBookings().length / this.PAGE_SIZE))
  );

  pagedUpcoming = computed(() => {
    const page = Math.min(this.upcomingPage(), this.upcomingPageCount());
    const start = (page - 1) * this.PAGE_SIZE;
    return this.upcomingBookings().slice(start, start + this.PAGE_SIZE);
  });

  pagedPast = computed(() => {
    const page = Math.min(this.pastPage(), this.pastPageCount());
    const start = (page - 1) * this.PAGE_SIZE;
    return this.pastBookings().slice(start, start + this.PAGE_SIZE);
  });

  /** Array of page numbers for template @for loops */
  upcomingPages = computed(() =>
    Array.from({ length: this.upcomingPageCount() }, (_, i) => i + 1)
  );
  pastPages = computed(() =>
    Array.from({ length: this.pastPageCount() }, (_, i) => i + 1)
  );

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
    this.loadWorkingHours();
    this.bookingEventsSub = this.bookingEvents.bookingsChanged$.subscribe(() => {
      this.loadBookings();
    });
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
    if (this.bookingEventsSub) {
      this.bookingEventsSub.unsubscribe();
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

  goToUpcomingPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.upcomingPageCount()));
    this.upcomingPage.set(clamped);
  }

  goToPastPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.pastPageCount()));
    this.pastPage.set(clamped);
  }

  loadBookings(): void {
    const id = this.memberProfileId();
    if (!id) return;
    this.lastLoadedMemberProfileId = id;

    this.loading.set(true);
    this.error.set(null);

    this.bookingService
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
    this.bookingService
      .cancelBooking(bookingId)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res) {
          this.loadBookings();
          this.bookingCancelled.emit(bookingId);
        }
      });
  }

  // ── Manual Booking Form Panel State & Methods ──────────────────────────
  showBookingForm = signal(false);
  selectedDate = signal('');
  selectedSlot = signal('');
  availableSlots = signal<string[]>([]);
  isLoadingSlots = signal(false);
  bookingError = signal('');
  bookingSuccess = signal(false);
  bookingSubmitLoading = signal(false);
  workingHours = signal<WorkingHoursDto[]>([]);

  loadWorkingHours(): void {
    this.workingHoursService.getWorkingHours().subscribe({
      next: data => {
        this.workingHours.set(data ?? []);
      },
      error: err => {
        console.error('Failed to load working hours', err);
      }
    });
  }

  toggleBookingForm(): void {
    this.showBookingForm.set(!this.showBookingForm());
    if (!this.showBookingForm()) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.selectedDate.set('');
    this.selectedSlot.set('');
    this.availableSlots.set([]);
    this.bookingError.set('');
    this.bookingSuccess.set(false);
  }

  onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const dateVal = target.value;
    this.selectedDate.set(dateVal);
    this.selectedSlot.set('');
    this.bookingError.set('');
    this.bookingSuccess.set(false);

    if (!dateVal) {
      this.availableSlots.set([]);
      return;
    }

    this.isLoadingSlots.set(true);
    try {
      const [year, month, day] = dateVal.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);
      const dayIndex = parsedDate.getDay();
      const workingDayEnumIndex = (dayIndex + 6) % 7;

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const selectedDayName = days[workingDayEnumIndex];

      const workingHour = this.workingHours().find(wh => {
        if (typeof wh.dayOfWeek === 'number') {
          return wh.dayOfWeek === workingDayEnumIndex;
        }
        return String(wh.dayOfWeek).toLowerCase() === selectedDayName.toLowerCase();
      });

      if (!workingHour || workingHour.isClosed) {
        this.availableSlots.set([]);
        this.bookingError.set(this.translate.instant('GymIsClosed'));
      } else {
        const slots = this.generateSlots(workingHour.openTime, workingHour.closeTime);
        this.availableSlots.set(slots);
      }
    } catch (e) {
      console.error(e);
      this.bookingError.set('Invalid date selection');
    } finally {
      this.isLoadingSlots.set(false);
    }
  }

  selectSlot(slot: string): void {
    if (this.isSlotDisabled(slot)) return;
    this.selectedSlot.set(slot);
    this.bookingError.set('');
    this.bookingSuccess.set(false);
  }

  generateSlots(openTime: string, closeTime: string): string[] {
    const slots: string[] = [];
    const [openH] = openTime.split(':').map(Number);
    const [closeH] = closeTime.split(':').map(Number);

    if (closeH < openH) {
      // Shift crosses midnight
      for (let h = openH; h < 24; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00:00`);
      }
      for (let h = 0; h < closeH; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00:00`);
      }
    } else {
      // Normal shift
      for (let h = openH; h < closeH; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00:00`);
      }
    }
    return slots;
  }

  isSlotDisabled(slot: string): boolean {
    if (!this.selectedDate()) return true;

    const egyptNow = this.getEgyptTime();
    const todayStr = egyptNow.toISOString().split('T')[0];

    if (this.selectedDate() === todayStr) {
      const [slotH] = slot.split(':').map(Number);
      const currentH = egyptNow.getHours();
      if (slotH <= currentH) {
        return true;
      }
    }

    const dayBookings = this.bookings().filter(b => {
      const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
      return isConfirmed && b.bookingDate.split('T')[0] === this.selectedDate();
    });

    const slotH = Number(slot.split(':')[0]);
    const hasGapConflict = dayBookings.some(b => {
      const bH = Number(b.startTime.split(':')[0]);
      return Math.abs(bH - slotH) < 5;
    });

    return hasGapConflict;
  }

  formatSlotTime(slot: string): string {
    const lang = this.translate.currentLang || 'en';
    const [hStr] = slot.split(':');
    let hours = parseInt(hStr, 10);
    
    let ampm = hours >= 12 ? 'PM' : 'AM';
    if (lang === 'ar') {
      ampm = hours >= 12 ? 'م' : 'ص';
    }
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:00 ${ampm}`;
  }

  getEgyptTime(): Date {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  }

  get minDate(): string {
    const egyptNow = this.getEgyptTime();
    return egyptNow.toISOString().split('T')[0];
  }

  confirmBookingSubmit(): void {
    const id = this.memberProfileId();
    if (!id || !this.selectedDate() || !this.selectedSlot()) return;

    this.bookingSubmitLoading.set(true);
    this.bookingError.set('');
    this.bookingSuccess.set(false);

    const [h] = this.selectedSlot().split(':').map(Number);
    const endH = (h + 1) % 24;
    const endTimeStr = `${String(endH).padStart(2, '0')}:00:00`;

    const dto = {
      memberProfileId: id,
      bookingDate: this.selectedDate(),
      startTime: this.selectedSlot(),
      endTime: endTimeStr,
      source: BookingSource.Manual
    };

    this.bookingService.createBooking(dto).subscribe({
      next: () => {
        this.bookingSubmitLoading.set(false);
        this.bookingSuccess.set(true);
        this.selectedSlot.set('');
        
        this.loadBookings();
        this.bookingEvents.notifyBookingsChanged();
        
        setTimeout(() => {
          this.showBookingForm.set(false);
          this.resetForm();
        }, 2000);
      },
      error: err => {
        this.bookingSubmitLoading.set(false);
        const rawMsg = err.message || 'An error occurred';
        const keyMapping: Record<string, string> = {
          'BookingGapViolation': 'bookingGapError',
          'ActiveSubscriptionRequired': 'noActiveSubscriptionError',
          'NoRemainingSessions': 'noRemainingSessionsError',
          'BookingTimeCannotBeInPast': 'BookingTimeCannotBeInPast',
          'DuplicateBooking': 'DuplicateBooking',
          'GymIsClosed': 'GymIsClosed'
        };
        const mappedKey = keyMapping[rawMsg];
        const translatedMsg = mappedKey ? this.translate.instant(mappedKey) : this.translate.instant(rawMsg);
        this.bookingError.set(translatedMsg);
      }
    });
  }
}
