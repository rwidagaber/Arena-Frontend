import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  iframeUrl: SafeResourceUrl | null = null;
  paymentStatus: 'pending' | 'success' | 'failed' = 'pending';
  hasAi = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Check if this is a redirect from Paymob after payment
      if (params['success'] !== undefined) {
        // If we are inside an iframe, break out to top window
        if (window.top !== window.self) {
          window.top!.location.href = window.location.href;
          return;
        }

        // We are out of the iframe, show status
        this.paymentStatus = params['success'] === 'true' ? 'success' : 'failed';
        this.iframeUrl = null; // hide iframe

        // Retrieve saved hasAI status from local storage
        const savedHasAi = localStorage.getItem('checkout_plan_has_ai');
        if (savedHasAi !== null) {
          this.hasAi = savedHasAi === 'true';
        }

        // Add a delay before refreshing to allow the Paymob webhook to process in the backend!
        if (this.paymentStatus === 'success') {
          setTimeout(() => {
            this.authService.refresh().subscribe({
              next: () => {
                console.log('Auth token refreshed after payment webhook delay');
                this.authService.getMe().subscribe({
                  next: (profile) => {
                    if (profile?.activeSubscription) {
                      this.hasAi = !!profile.activeSubscription.hasAI;
                    }
                    localStorage.removeItem('checkout_plan_has_ai');
                  },
                  error: () => localStorage.removeItem('checkout_plan_has_ai')
                });
              },
              error: err => {
                console.error('Failed to refresh token after payment', err);
                localStorage.removeItem('checkout_plan_has_ai');
              }
            });
          }, 3000); // 3-second delay prevents the race condition
        } else {
          localStorage.removeItem('checkout_plan_has_ai');
        }
        return;
      }

      // Initial load: display the Paymob iframe
      const url = params['url'];
      if (url) {
        this.iframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      } else {
        this.router.navigate(['/home']);
      }
    });
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  goToPaymentHistory(): void {
    this.router.navigate(['/my-payments']);
  }
}
