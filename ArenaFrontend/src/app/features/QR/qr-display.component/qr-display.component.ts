import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { AuthService } from '../../../core/services/auth';
import { BookingService } from '../../../core/services/booking.service';
import { environment } from '../../../../environments/environment';
import { BookingDto, QrDto, QrScanResultDto } from '../qr.model';
import { QrService } from '../qr.service';

@Component({
  selector: 'app-qr-display',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './qr-display.component.html',
  styleUrls: ['./qr-display.component.css'],
})
export class QrDisplayComponent implements OnInit, OnChanges, OnDestroy {
  @Input() memberProfileId = '';

  private route = inject(ActivatedRoute);
  private qrService = inject(QrService);
  private bookingService = inject(BookingService);
  private auth = inject(AuthService);

  bookingId = '';
  scanCode = '';
  scannerId = '';

  bookings: BookingDto[] = [];
  selectedBooking: BookingDto | null = null;
  qrData: QrDto | null = null;
  scanResult: QrScanResultDto | null = null;
  qrImageUrl = '';
  isLoading = false;
  isLoadingBookings = false;
  isScanning = false;
  error = '';
  scanError = '';
  isExpired = false;
  timeLeft = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private bookingRequestMemberProfileId = '';

  ngOnInit(): void {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';
    this.scanCode = this.route.snapshot.queryParamMap.get('code') ?? '';

    const cached = this.auth.currentUser$.subscribe(user => {
      this.scannerId = user?.id ?? user?.memberProfileId ?? '';
    });
    cached.unsubscribe();

    if (this.scanCode) {
      setTimeout(() => this.confirmScan());
      return;
    }

    if (this.bookingId) {
      this.generateQr(this.bookingId);
      return;
    }

    this.loadBookings();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memberProfileId'] && !this.bookingId && !this.scanCode) {
      this.bookings = [];
      this.selectedBooking = null;
      this.loadBookings();
    }
  }

  loadBookings(): void {
    if (!this.memberProfileId) return;
    if (this.isLoadingBookings && this.bookingRequestMemberProfileId === this.memberProfileId) return;

    const requestMemberProfileId = this.memberProfileId;
    this.bookingRequestMemberProfileId = requestMemberProfileId;
    this.isLoadingBookings = true;
    this.error = '';

    this.bookingService.getBookings(requestMemberProfileId).subscribe({
      next: bookings => {
        if (this.memberProfileId !== requestMemberProfileId) return;

        this.bookings = bookings
          .filter(booking => this.isTodayConfirmedAndActive(booking))
          .sort((a, b) => this.sessionStartsAt(a).getTime() - this.sessionStartsAt(b).getTime());

        this.isLoadingBookings = false;

        if (this.bookings.length && !this.selectedBooking) {
          this.selectBooking(this.bookings[0]);
        }
      },
      error: err => {
        if (this.memberProfileId !== requestMemberProfileId) return;

        this.error = err?.message || 'Failed to load upcoming sessions';
        this.isLoadingBookings = false;
      },
    });
  }

  selectBooking(booking: BookingDto): void {
    this.selectedBooking = booking;
    this.generateQr(booking.id);
  }

  generateQr(bookingId: string): void {
    this.clearTimer();
    this.isLoading = true;
    this.error = '';
    this.isExpired = false;
    this.qrImageUrl = '';
    this.qrData = null;

    this.qrService.generate(bookingId).subscribe({
      next: async data => {
        this.qrData = data;
        this.isLoading = false;

        const scanUrl = `${environment.apiUrl}/qr/scan/${encodeURIComponent(data.code)}`;
        this.qrImageUrl = await QRCode.toDataURL(scanUrl, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        this.startCountdown();
      },
      error: err => {
        this.error = err.error?.message || err?.message || 'Failed to generate QR code';
        this.isLoading = false;
      },
    });
  }

  confirmScan(): void {
    if (!this.scanCode) return;

    this.isScanning = true;
    this.scanError = '';
    this.scanResult = null;

    this.qrService.scan({
      code: this.scanCode,
      scannedById: this.scannerId || '00000000-0000-0000-0000-000000000000',
    }).subscribe({
      next: result => {
        this.scanResult = result;
        this.isScanning = false;
      },
      error: err => {
        this.scanError = err.error?.message || err?.message || 'Scan failed. Please try again.';
        this.isScanning = false;
      },
    });
  }

  formatSessionDate(booking: BookingDto | null): string {
    if (!booking) return '';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(booking.bookingDate));
  }

  formatSessionTime(booking: BookingDto | null): string {
    if (!booking) return '';
    const start = this.formatTime(booking.startTime);
    const end = booking.endTime ? this.formatTime(booking.endTime) : '';
    return end ? `${start} - ${end}` : start;
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startCountdown(): void {
    this.timer = setInterval(() => {
      if (!this.qrData) return;

      const diff = new Date(this.qrData.expirationTime).getTime() - Date.now();

      if (diff <= 0) {
        this.isExpired = true;
        this.timeLeft = 'Expired';
        this.qrData = null;
        this.qrImageUrl = '';
        this.selectedBooking = null;
        this.loadBookings();
        this.clearTimer();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      this.timeLeft = `${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private isTodayConfirmedAndActive(booking: BookingDto): boolean {
    const status = String(booking.status).toLowerCase();
    const isConfirmed = status === '1' || status === 'confirmed';
    if (!isConfirmed) return false;

    const sessionStart = this.sessionStartsAt(booking);
    const now = new Date();

    // Check if session start is not too far in the past (e.g. at least within the last 2 hours)
    const tooOld = sessionStart.getTime() <= now.getTime() - (2 * 60 * 60 * 1000);
    if (tooOld) return false;

    // Calculate shift date for the booking
    const bDateStr = booking.bookingDate.split('T')[0];
    const [bYr, bMo, bDy] = bDateStr.split('-').map(Number);
    const [bH] = booking.startTime.split(':').map(Number);
    
    const bShiftDate = new Date(bYr, bMo - 1, bDy);
    if (bH <= 3) {
      // 00:00 to 03:00 belong to previous day's shift
      bShiftDate.setDate(bShiftDate.getDate() - 1);
    }
    const bShiftDateStr = bShiftDate.getFullYear() + '-' + 
      String(bShiftDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(bShiftDate.getDate()).padStart(2, '0');

    // Calculate shift date for "now" (current local time)
    const nowH = now.getHours();
    const nowShiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (nowH <= 3) {
      // If it is between midnight and 3 AM local time, we are still in yesterday's shift
      nowShiftDate.setDate(nowShiftDate.getDate() - 1);
    }
    const nowShiftDateStr = nowShiftDate.getFullYear() + '-' + 
      String(nowShiftDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(nowShiftDate.getDate()).padStart(2, '0');

    return bShiftDateStr === nowShiftDateStr;
  }

  private sessionStartsAt(booking: BookingDto): Date {
    const date = new Date(booking.bookingDate);
    const [hours = 0, minutes = 0, seconds = 0] = booking.startTime.split(':').map(Number);
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }

  private sessionEndsAt(booking: BookingDto): Date {
    const end = new Date(booking.bookingDate);
    const fallbackEnd = this.sessionStartsAt(booking);
    fallbackEnd.setHours(fallbackEnd.getHours() + 2);

    if (!booking.endTime) return fallbackEnd;

    const [hours = 0, minutes = 0, seconds = 0] = booking.endTime.split(':').map(Number);
    end.setHours(hours + 2, minutes, seconds, 0);
    return end;
  }

  private formatTime(value: string): string {
    const [hours = 0, minutes = 0] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}
