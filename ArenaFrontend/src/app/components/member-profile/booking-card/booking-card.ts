import { Component, input, output, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BookingDto } from '../../../features/QR/qr.model';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './booking-card.html',
  styleUrl: './booking-card.css'
})
export class BookingCardComponent implements OnInit, OnDestroy {
  private translationService = inject(TranslationService);

  booking = input.required<BookingDto>();
  cancel = output<string>();

  countdownText = signal<string | null>(null);
  countdownClass = signal<string>('');
  private timerId: any = null;

  ngOnInit(): void {
    this.updateCountdown();
    this.timerId = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateCountdown(): void {
    const status = this.booking().status;
    const isConfirmed = status === 1 || status === '1' || status === 'Confirmed';
    if (!isConfirmed) {
      this.countdownText.set(null);
      return;
    }

    try {
      const dateStr = this.booking().bookingDate.split('T')[0];
      const timeStr = this.booking().startTime;
      const bookingDateTime = new Date(`${dateStr}T${timeStr}`);
      const diff = bookingDateTime.getTime() - Date.now();

      if (diff <= 0) {
        this.countdownText.set(null);
        return;
      }

      const lang = this.translationService.currentLang();

      if (diff > 24 * 60 * 60 * 1000) {
        this.countdownClass.set('future-timer');
        const daysCeil = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (lang === 'ar') {
          if (daysCeil === 1) {
            this.countdownText.set('يبدأ غداً');
          } else if (daysCeil === 2) {
            this.countdownText.set('يبدأ خلال يومين');
          } else if (daysCeil >= 3 && daysCeil <= 10) {
            this.countdownText.set(`يبدأ خلال ${daysCeil} أيام`);
          } else {
            this.countdownText.set(`يبدأ خلال ${daysCeil} يوماً`);
          }
        } else {
          if (daysCeil === 1) {
            this.countdownText.set('Starts tomorrow');
          } else {
            this.countdownText.set(`Starts in ${daysCeil} days`);
          }
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const isLocked = diff < (5 * 60 * 60 * 1000);

      if (isLocked) {
        this.countdownClass.set('locked-timer');
        if (lang === 'ar') {
          this.countdownText.set(`يبدأ بعد ${hours}س ${minutes}د ${seconds}ث (الإلغاء مغلق)`);
        } else {
          this.countdownText.set(`Starts in ${hours}h ${minutes}m ${seconds}s (Locked)`);
        }
      } else {
        this.countdownClass.set('active-timer');
        if (lang === 'ar') {
          this.countdownText.set(`يبدأ بعد ${hours}س ${minutes}د ${seconds}ث`);
        } else {
          this.countdownText.set(`Starts in ${hours}h ${minutes}m ${seconds}s`);
        }
      }
    } catch {
      this.countdownText.set(null);
    }
  }

  formattedDate = computed(() => {
    const dateStr = this.booking().bookingDate;
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const lang = this.translationService.currentLang();
 return new Intl.DateTimeFormat(
  lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
  {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
).format(date);
  });

  statusLabel = computed(() => {
    const status = this.booking().status;
    
    // Rule 1: If the booking is canceled -> return "Booking canceled"
    if (status === 2 || status === '2' || status === 'Cancelled') {
      return 'Cancelled';
    }
    
    // Rule 2: If the booking has been QR scanned / checked-in -> return "Completed"
    if (status === 3 || status === '3' || status === 'Completed') {
      return 'Completed';
    }

    // Rule 2b: If the booking is expired -> return "Expired"
    if (status === 4 || status === '4' || status === 'Expired') {
      return 'Expired';
    }
    
    // Rules 3 & 4: Compare booking date/time with current system time
    try {
      const dateStr = this.booking().bookingDate.split('T')[0];
      const timeStr = this.booking().startTime;
      const bookingDateTime = new Date(`${dateStr}T${timeStr}`);
      
      if (bookingDateTime.getTime() > Date.now()) {
        // Date is in the future -> return "Upcoming Bookings"
        return 'Confirmed';
      }
      // Date is in the past AND NOT scanned -> return "Past Booking"
      return 'Completed';
    } catch {
      return 'Completed';
    }
  });

  statusClass = computed(() => {
    const label = this.statusLabel().toLowerCase();
    return `status-badge ${label}`;
  });

  isCancelable = computed(() => {
    const status = this.booking().status;
    const isConfirmed = status === 1 || status === '1' || status === 'Confirmed';
    if (!isConfirmed) return false;

    try {
      // Parse date and time to see if it is at least 5 hours in the future
      const dateStr = this.booking().bookingDate.split('T')[0];
      const timeStr = this.booking().startTime;
      const bookingDateTime = new Date(`${dateStr}T${timeStr}`);
      return (bookingDateTime.getTime() - Date.now()) >= (5 * 60 * 60 * 1000);
    } catch {
      return false; // Fallback to safe block
    }
  });

  onCancelClick(): void {
    if (this.isCancelable()) {
      this.cancel.emit(this.booking().id);
    }
  }
}
