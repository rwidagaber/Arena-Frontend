import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-floating-chat-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './floating-chat-button.html',
  styleUrls: ['./floating-chat-button.css']
})
export class FloatingChatButtonComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  isLoading = true;
  hasAIAccess = false;
  isLoggedIn = false;
  showModal = false;
  isHidden = false;       // hide on /chat route and hideLayout pages
  showTooltip = false;

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn;
    this.resolveAccess();

    // Listen to route changes to hide on /chat and detect login state changes
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        const navEnd = event as NavigationEnd;
        this.isHidden = navEnd.urlAfterRedirects.startsWith('/chat');
        // Re-check login state on navigation (user may have logged in/out)
        const wasLoggedIn = this.isLoggedIn;
        this.isLoggedIn = this.auth.isLoggedIn;
        if (this.isLoggedIn !== wasLoggedIn) {
          this.resolveAccess();
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    if (this.showModal) {
      this.closeModal();
    }
  }

  onFabClick(): void {
    if (this.isLoading) return;

    if (this.hasAIAccess) {
      this.router.navigate(['/chat']);
    } else {
      this.showModal = true;
    }
  }

  closeModal(): void {
    this.showModal = false;
  }

  goToSubscription(): void {
    this.showModal = false;
    this.router.navigate(['/'], { fragment: 'membership' });
  }

  stayHome(): void {
    this.showModal = false;
  }

  private resolveAccess(): void {
    if (!this.isLoggedIn) {
      this.hasAIAccess = false;
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.auth.getMe().subscribe({
      next: (profile) => {
        this.hasAIAccess = !!profile?.activeSubscription?.hasAI;
        this.isLoading = false;
      },
      error: () => {
        this.hasAIAccess = false;
        this.isLoading = false;
      }
    });
  }
}
