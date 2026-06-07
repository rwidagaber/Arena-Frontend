import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PricingService } from '../../core/services/pricing.service';
import { SubscriptionPlan } from '../../core/models/subscription-plan';
import { AuthService } from '../../core/services/auth';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {
  plans: SubscriptionPlan[] = [];
  loading = true;
  error = '';
  paymentLoading = false; // Add state to show loading during payment initiation

  // Translation keys for included features
  includedFeatures = [
    'PRICING.FEATURE_1',
    'PRICING.FEATURE_2',
    'PRICING.FEATURE_3',
    'PRICING.FEATURE_4'
  ];

  constructor(
    private pricingService: PricingService,
    private authService: AuthService,
    private router: Router,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.pricingService.getSubscriptionPlans().subscribe({
      next: (data) => {
        this.plans = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = this.translate.instant('PRICING.ERROR_LOAD');
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
        const errMsg = err.error?.message || err.message || this.translate.instant('PRICING.ERROR_UNKNOWN');
        alert(this.translate.instant('PRICING.ERROR_PAYMENT') + errMsg);
        console.error('Payment Error:', err);
      }
    });
  }
}
