import { Component, inject, Input, OnInit } from '@angular/core';
import { QrService } from '../qr.service';
import { QrDto } from '../qr.model';
import QRCode from 'qrcode';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-display',
    standalone: true,             
  imports: [CommonModule], 
  templateUrl: './qr-display.component.html',
  styleUrls: ['./qr-display.component.css']
})
export class QrDisplayComponent implements OnInit {
  // @Input() bookingId!: string;

  private route = inject(ActivatedRoute);
  private qrService = inject(QrService);

  bookingId='';

  qrData: QrDto | null = null;
  qrImageUrl: string = '';
  isLoading = false;
  error = '';
  isExpired = false;
  timeLeft = '';
  private timer: any;

  // constructor(private qrService: QrService) {}

  // ngOnInit(): void {
  //   this.generateQr();
  // }
 ngOnInit(): void {
    
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';
    
    if (this.bookingId) {
      this.generateQr();
    }
  }
  generateQr(): void {
    this.isLoading = true;
    this.error = '';

    this.qrService.generate(this.bookingId).subscribe({
      next: async (data) => {
        this.qrData = data;
        this.isLoading = false;

        // ✅ Generate QR image from code string
        this.qrImageUrl = await QRCode.toDataURL(data.code, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        // ✅ Start expiration countdown
        this.startCountdown();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to generate QR code';
        this.isLoading = false;
      }
    });
  }

  startCountdown(): void {
    this.timer = setInterval(() => {
      if (!this.qrData) return;

      const now = new Date().getTime();
      const expiry = new Date(this.qrData.expirationTime).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        this.isExpired = true;
        this.timeLeft = 'Expired';
        clearInterval(this.timer);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      this.timeLeft = `${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}