import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BookingDto } from '../../../features/QR/qr.model';

@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './booking-card.html',
  styleUrl: './booking-card.css'
})
export class BookingCardComponent {
  booking = input.required<BookingDto>();
  cancel = output<string>();

  statusLabel = computed(() => {
    const status = this.booking().status;
    if (status === 1 || status === '1' || status === 'Confirmed') {
      return 'Confirmed';
    } else if (status === 2 || status === '2' || status === 'Cancelled') {
      return 'Cancelled';
    } else if (status === 3 || status === '3' || status === 'Completed') {
      return 'Completed';
    }
    return 'Pending';
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
