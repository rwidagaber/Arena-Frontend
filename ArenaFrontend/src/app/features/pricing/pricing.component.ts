import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PricingService } from '../../core/services/pricing.service';
import { SubscriptionPlan } from '../../core/models/subscription-plan';
import { AuthService } from '../../core/services/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, TranslateModule, ScrollRevealDirective],
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css']
})
export class PricingComponent implements OnInit {
  plans: SubscriptionPlan[] = [];
  aiPlans: SubscriptionPlan[] = [];
  standardPlans: SubscriptionPlan[] = [];
  loading = true;
  error = '';
  loadingPlanId: string | null = null; // Track which plan is loading during payment initiation
  showUpgradeModal = false;

  aiFeatures = [
    { key: 'PRICING.FEATURES.WORKOUT', enabled: true },
    { key: 'PRICING.FEATURES.NUTRITION', enabled: true },
    { key: 'PRICING.FEATURES.PROGRESS', enabled: true },
    { key: 'PRICING.FEATURES.QR', enabled: true },
    { key: 'PRICING.FEATURES.BOOKING', enabled: true }
  ];

  standardFeatures = [
    { key: 'PRICING.FEATURES.QR', enabled: true },
    { key: 'PRICING.FEATURES.BOOKING', enabled: true },
    { key: 'PRICING.FEATURES.WORKOUT_LOCKED', enabled: false },
    { key: 'PRICING.FEATURES.NUTRITION_LOCKED', enabled: false },
    { key: 'PRICING.FEATURES.PROGRESS_LOCKED', enabled: false }
  ];

  constructor(
    private pricingService: PricingService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['showUpgradeAlert'] === 'true') {
        this.showUpgradeModal = true;
        // Clean up parameters from the URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { showUpgradeAlert: null },
          queryParamsHandling: 'merge'
        });
      }
    });
    this.pricingService.getSubscriptionPlans().subscribe({
      next: (data) => {
        this.plans = data;
        // Group and sort plans by duration
        this.aiPlans = data.filter(p => p.hasAI).sort((a, b) => a.durationMonths - b.durationMonths);
        this.standardPlans = data.filter(p => !p.hasAI).sort((a, b) => a.durationMonths - b.durationMonths);
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
      this.router.navigate(['/login']);
      return;
    }

    const selectedPlan = this.plans.find(p => p.id === planId);
    if (selectedPlan) {
      localStorage.setItem('checkout_plan_has_ai', String(selectedPlan.hasAI));
    }

    this.loadingPlanId = planId;
    // 4 = Paymob payment method
    this.pricingService.createPayment(planId, 4).subscribe({
      next: (response) => {
        this.loadingPlanId = null;
        if (response && response.iframeUrl) {
          this.router.navigate(['/checkout'], {
            queryParams: { url: response.iframeUrl }
          });
        }
      },
      error: (err) => {
        this.loadingPlanId = null;
        const errMsg = err.message || err.error?.message || this.translate.instant('PRICING.ERROR_UNKNOWN');
        
        // Show premium custom alert popup instead of browser alert
        this.notificationService.showAlert({
          type: 'Error',
          eyebrow: 'Payment Failed',
          title: this.translate.instant('PRICING.ERROR_PAYMENT') || 'Payment Error',
          message: errMsg,
          ctaText: 'OK'
        });

        console.error('Payment Error:', err);
      }
    });
  }

  closeUpgradeModal(): void {
    this.showUpgradeModal = false;
  }

  isDiscountActive(plan: SubscriptionPlan): boolean {
    if (!plan.discountPercentage || plan.discountPercentage <= 0) {
      return false;
    }
    if (plan.discountEndDate) {
      return new Date(plan.discountEndDate) > new Date();
    }
    return true;
  }

  getDiscountedPrice(plan: SubscriptionPlan): number {
    if (this.isDiscountActive(plan)) {
      return plan.price * (1 - (plan.discountPercentage || 0) / 100);
    }
    return plan.price;
  }

  getRemainingDays(plan: SubscriptionPlan): number | null {
    if (!plan.discountEndDate) {
      return null;
    }
    const end = new Date(plan.discountEndDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
