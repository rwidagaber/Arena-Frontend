import { Component, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BookingDto } from '../../../features/QR/qr.model';
import { TranslationService } from '../../../core/services/translation.service';

interface CalendarDay {
  day: number;
  isToday: boolean;
  hasUpcoming: boolean;
  hasPast: boolean;
  bookings: BookingDto[];
}

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './booking-calendar.html',
  styleUrl: './booking-calendar.css'
})
export class BookingCalendarComponent {
  private translationService = inject(TranslationService);

  bookings = input<BookingDto[]>([]);

  currentDate = signal(new Date());

  monthName = computed(() => {
    const lang = this.translationService.currentLang();
    return this.currentDate().toLocaleString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { month: 'long' });
  });

  year = computed(() => {
    return this.currentDate().getFullYear();
  });

  daysOfWeek = computed(() => {
    const lang = this.translationService.currentLang();
    return lang === 'ar'
      ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  });

  calendarDays = computed(() => {
    const year = this.currentDate().getFullYear();
    const month = this.currentDate().getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const todayDate = today.getDate();

    const days: CalendarDay[] = [];

    // Empty padding for start of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: 0, isToday: false, hasUpcoming: false, hasPast: false, bookings: [] });
    }

    const currentBookings = this.bookings();

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = isCurrentMonth && d === todayDate;
      const targetDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // Filter bookings for this day
      const dayBookings = currentBookings.filter(b => {
        const bDatePart = b.bookingDate.split('T')[0];
        return bDatePart === targetDateString;
      });

      let hasUpcoming = false;
      let hasPast = false;

      dayBookings.forEach(b => {
        const isConfirmed = b.status === 1 || b.status === '1' || b.status === 'Confirmed';
        const isCancelled = b.status === 2 || b.status === '2' || b.status === 'Cancelled';

        if (isCancelled) {
          hasPast = true;
        } else if (isConfirmed) {
          try {
            const bDateTime = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`);
            if (bDateTime.getTime() > Date.now()) {
              hasUpcoming = true;
            } else {
              hasPast = true;
            }
          } catch {
            hasUpcoming = true;
          }
        } else {
          hasPast = true;
        }
      });

      days.push({
        day: d,
        isToday,
        hasUpcoming,
        hasPast,
        bookings: dayBookings
      });
    }

    return days;
  });

  prevMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }
}
