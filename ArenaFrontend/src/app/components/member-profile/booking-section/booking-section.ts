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
import { NotificationService } from '../../../core/services/notification.service';

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
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);

  /** The member-profile id used to fetch bookings */
  memberProfileId = input.required<string>();

  /** The remaining session count from parent member profile */
  remainingSessions = input<number | null>(null);

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
      const isCancelled = b.status === 2 || b.status === '2' || b.status === 'Cancelled';
      if (isCancelled) return true; // Cancelled bookings always appear in history
      const isExpired = b.status === 4 || b.status === '4' || b.status === 'Expired';
      if (isExpired) return true; // Expired bookings always appear in history
      const isConfirmedOrCompleted = 
        b.status === 1 || b.status === '1' || b.status === 'Confirmed' ||
        b.status === 3 || b.status === '3' || b.status === 'Completed';
      if (!isConfirmedOrCompleted) return false; // Hide Pending/Unknown from history
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

  bookingStats = computed<StatItem[]>(() => {
    const rem = this.remainingSessions();
    return [
      {
        label: 'remainingSessions',
        value: rem !== null ? rem.toString() : '0',
        icon: 'fas fa-dumbbell',
      },
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
    ];
  });

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

  async onCancelBooking(bookingId: string): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This cannot be undone.',
      'Cancel Session',
      'Keep Session',
      'Booking Cancellation'
    );

    if (!confirmed) return;

    this.bookingService
      .cancelBooking(bookingId)
      .subscribe({
        next: () => {
          this.loadBookings();
          this.bookingCancelled.emit(bookingId);
        },
        error: (err) => {
          const rawMsg = err.message || 'An error occurred';
          this.notificationService.showLocalToast(
            'Cancellation Failed',
            rawMsg,
            'Error'
          );
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
        const dayVal = wh.dayOfWeek;
        if (typeof dayVal === 'number') return dayVal === workingDayEnumIndex;
        // Handle numeric strings like '0', '1', etc. (some serializers return strings)
        const numericVal = parseInt(String(dayVal), 10);
        if (!isNaN(numericVal)) return numericVal === workingDayEnumIndex;
        // Handle day-name strings like 'Monday', 'Tuesday', etc.
        return String(dayVal).toLowerCase() === selectedDayName.toLowerCase();
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
      for (let h = 0; h <= closeH; h++) {
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
    const [slotH] = slot.split(':').map(Number);

    if (this.selectedDate() === todayStr) {
      const currentH = egyptNow.getHours();

      // Find today's working hours to detect midnight-crossing shifts
      const [yr, mo, dy] = this.selectedDate().split('-').map(Number);
      const dayIdx = new Date(yr, mo - 1, dy).getDay();
      const wdIdx = (dayIdx + 6) % 7;
      const todayWH = this.workingHours().find(wh => {
        const d = typeof wh.dayOfWeek === 'number'
          ? wh.dayOfWeek
          : parseInt(String(wh.dayOfWeek), 10);
        return !isNaN(d) ? d === wdIdx : String(wh.dayOfWeek).toLowerCase() ===
          ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][wdIdx];
      });

      if (todayWH) {
        const openH  = parseInt(String(todayWH.openTime).split(':')[0], 10);
        const closeH = parseInt(String(todayWH.closeTime).split(':')[0], 10);
        const isMidnightCrossing = closeH < openH;          // e.g. open=8, close=3
        const isMidnightSlot     = isMidnightCrossing && slotH <= closeH; // 0,1,2,3 AM

        if (isMidnightSlot) {
          // We are already past midnight (currentH < openH, e.g. 01:00)
          // → disable only if we have passed this slot
          if (currentH < openH && slotH <= currentH) {
            return true;
          }
        } else {
          // Normal slot past-time check
          if (slotH <= currentH) return true;
        }
      } else {
        // Normal past-time check
        if (slotH <= currentH) return true;
      }
    }

    // --- Shift-aware Booking conflict checks ---
    const [yr, mo, dy] = this.selectedDate().split('-').map(Number);
    const slotDate = new Date(yr, mo - 1, dy);
    
    const dayIdx = slotDate.getDay();
    const wdIdx = (dayIdx + 6) % 7;
    const selectedWH = this.workingHours().find(wh => {
      const d = typeof wh.dayOfWeek === 'number' ? wh.dayOfWeek : parseInt(String(wh.dayOfWeek), 10);
      return !isNaN(d) ? d === wdIdx : String(wh.dayOfWeek).toLowerCase() ===
        ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][wdIdx];
    });

    if (selectedWH) {
      const openH  = parseInt(String(selectedWH.openTime).split(':')[0], 10);
      const closeH = parseInt(String(selectedWH.closeTime).split(':')[0], 10);
      const isMidnightCrossing = closeH < openH;
      const isMidnightSlot     = isMidnightCrossing && slotH <= closeH;
      if (isMidnightSlot) {
        slotDate.setDate(slotDate.getDate() + 1);
      }
    }

    slotDate.setHours(slotH, 0, 0, 0);
    const targetTimeMs = slotDate.getTime();

    const hasConflict = this.bookings().some(b => {
      const isConfirmedOrCompleted = 
        b.status === 1 || b.status === '1' || b.status === 'Confirmed' ||
        b.status === 3 || b.status === '3' || b.status === 'Completed';
      if (!isConfirmedOrCompleted) return false;

      const [bYr, bMo, bDy] = b.bookingDate.split('T')[0].split('-').map(Number);
      const [bH] = b.startTime.split(':').map(Number);
      const bDate = new Date(bYr, bMo - 1, bDy);
      bDate.setHours(bH, 0, 0, 0);

      const diffHours = Math.abs(bDate.getTime() - targetTimeMs) / 3600000;
      return diffHours < 5;
    });

    return hasConflict;
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

    // ── Midnight-crossing correction ──────────────────────────────────────
    // Slots 12 AM / 1 AM / 2 AM / 3 AM belong to the NEXT calendar day
    // when the shift crosses midnight (e.g. 08:00 → 03:00).
    // We detect this by comparing the slot hour with the shift's open hour.
    let bookingDate = this.selectedDate();
    const [yr, mo, dy] = bookingDate.split('-').map(Number);
    const dayIdx = new Date(yr, mo - 1, dy).getDay();
    const wdIdx  = (dayIdx + 6) % 7;
    const selectedWH = this.workingHours().find(wh => {
      const d = typeof wh.dayOfWeek === 'number'
        ? wh.dayOfWeek
        : parseInt(String(wh.dayOfWeek), 10);
      return !isNaN(d) ? d === wdIdx
        : String(wh.dayOfWeek).toLowerCase() ===
          ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][wdIdx];
    });
    if (selectedWH) {
      const openH  = parseInt(String(selectedWH.openTime).split(':')[0], 10);
      const closeH = parseInt(String(selectedWH.closeTime).split(':')[0], 10);
      const isMidnightCrossing = closeH < openH;      // e.g. open=8, close=3
      const isMidnightSlot     = isMidnightCrossing && h <= closeH; // 0,1,2,3 AM
      if (isMidnightSlot) {
        // Advance date by 1 day — these hours happen after midnight in a timezone-safe manner
        const next = new Date(yr, mo - 1, dy + 1);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        const d = String(next.getDate()).padStart(2, '0');
        bookingDate = `${y}-${m}-${d}`;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const dto = {
      memberProfileId: id,
      bookingDate,          // corrected date (next day for midnight-crossing slots)
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
        }, 1500);
      },
      error: err => {
        this.bookingSubmitLoading.set(false);
        const rawMsg = err.message || 'An error occurred';
        const keyMapping: Record<string, string> = {
          'BookingGapViolation': 'bookingGapError',
          'You must wait at least 5 hours between bookings on the same day.': 'bookingGapError',

          'ActiveSubscriptionRequired': 'noActiveSubscriptionError',
          'You need an active subscription to book a session.': 'noActiveSubscriptionError',

          'NoRemainingSessions': 'noRemainingSessionsError',
          'You have no remaining sessions. Please renew your subscription.': 'noRemainingSessionsError',

          'BookingTimeCannotBeInPast': 'BookingTimeCannotBeInPast',
          'That time has already passed today. Please choose a future time.': 'BookingTimeCannotBeInPast',

          'DuplicateBooking': 'DuplicateBooking',
          'You already have a booking at this date and time.': 'DuplicateBooking',

          'GymIsClosed': 'GymIsClosed',
          'The gym is closed or operating hours are invalid for this selection.': 'GymIsClosed',

          'BookingDateCannotBeInPast': 'BookingDateCannotBeInPast',
          'Booking date cannot be in the past': 'BookingDateCannotBeInPast'
        };
        const mappedKey = keyMapping[rawMsg];
        const translatedMsg = mappedKey ? this.translate.instant(mappedKey) : this.translate.instant(rawMsg);
        this.bookingError.set(translatedMsg);

        // Show premium error alert popup
        this.notificationService.showAlert({
          type: 'Error',
          eyebrow: 'Booking Failed',
          title: 'Unable to Book Session',
          message: translatedMsg,
          ctaText: 'OK'
        });
      }
    });
  }
}
