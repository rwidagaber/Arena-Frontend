import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PricingService } from '../../../core/services/pricing.service';
import { Payment } from '../../../core/models/payment';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-payments.component.html',
  styleUrls: ['./my-payments.component.css']
})
export class MyPaymentsComponent implements OnInit {
  payments: Payment[] = [];
  loading = true;
  error = '';

  constructor(
    private pricingService: PricingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.pricingService.getMyPayments().subscribe({
      next: (data) => {
        this.payments = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load payment history.';
        this.loading = false;
        console.error('Payment History Error:', err);
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'badge-success';
      case 'paid': return 'badge-success';
      case 'pending': return 'badge-warning';
      case 'failed': return 'badge-danger';
      default: return 'badge-default';
    }
  }

  getActivationClass(status?: string | null): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'badge-success';
      case 'pending': return 'badge-warning';
      case 'expired': return 'badge-danger';
      case 'cancelled': return 'badge-default';
      default: return 'badge-default';
    }
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
