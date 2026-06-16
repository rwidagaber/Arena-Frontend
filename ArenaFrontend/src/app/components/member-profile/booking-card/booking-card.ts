import { Component, input, output, computed, inject } from '@angular/core';
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
export class BookingCardComponent {
  private translationService = inject(TranslationService);

  booking = input.required<BookingDto>();
  cancel = output<string>();

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
      // Parse date and time to see if it's in the future
      const dateStr = this.booking().bookingDate.split('T')[0];
      const timeStr = this.booking().startTime;
      const bookingDateTime = new Date(`${dateStr}T${timeStr}`);
      return bookingDateTime.getTime() > Date.now();
    } catch {
      return true; // Fallback to allowing cancellation
    }
  });

  onCancelClick(): void {
    if (this.isCancelable()) {
      this.cancel.emit(this.booking().id);
    }
  }
}
