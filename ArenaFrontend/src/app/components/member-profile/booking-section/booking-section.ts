import { Component, OnInit, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { QrService } from '../../../features/QR/qr.service';
import { BookingDto } from '../../../features/QR/qr.model';
import { BookingCalendarComponent } from '../booking-calendar/booking-calendar';
import { BookingCardComponent } from '../booking-card/booking-card';
import { StatsOverview, StatItem } from '../stats-overview/stats-overview';

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
export class BookingSection implements OnInit {
  private qrService = inject(QrService);

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
  }

  // ── Actions ────────────────────────────────────────────────────────
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
