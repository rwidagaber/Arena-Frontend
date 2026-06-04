import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PricingService } from '../../core/services/pricing.service';
import { SubscriptionPlan } from '../../core/models/subscription-plan';
import { AuthService } from '../../core/services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {
  plans: SubscriptionPlan[] = [];
  loading = true;
  error = '';
  paymentLoading = false; // Add state to show loading during payment initiation

  // Hardcoded features as per Option A
  includedFeatures = [
    'Priority Support & Premium Locker',
    'High-energy group fitness classes',
    'Motivating & supportive environment',
    'Fitness assessment & progress'
  ];

  constructor(
    private pricingService: PricingService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.pricingService.getSubscriptionPlans().subscribe({
      next: (data) => {
        this.plans = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load subscription plans.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  onJoinNow(planId: string): void {
    if (!this.authService.isLoggedIn) {
      // Option A: redirect to login
      this.router.navigate(['/login']);
      return;
    }

    this.paymentLoading = true;
    // 4 = Paymob payment method
    this.pricingService.createPayment(planId, 4).subscribe({
      next: (response) => {
        this.paymentLoading = false;
        if (response && response.iframeUrl) {
          // Navigate to checkout and pass the URL
          this.router.navigate(['/checkout'], {
            queryParams: { url: response.iframeUrl }
          });
        }
      },
      error: (err) => {
        this.paymentLoading = false;
        const errMsg = err.error?.message || err.message || 'Unknown error';
        alert('Failed to initiate payment. Reason: ' + errMsg);
        console.error('Payment Error:', err);
      }
    });
  }
}
