import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
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
}
