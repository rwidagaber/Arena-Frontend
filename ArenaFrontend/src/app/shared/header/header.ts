import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly t = inject(TranslationService);
  readonly auth = inject(AuthService);
  private userSub?: Subscription;

  protected readonly displayName = signal('');
  activeTab: string = 'home';

  ngOnInit(): void {
    this.userSub = this.auth.currentUser$.subscribe(u => {
      this.displayName.set(u?.firstName ?? '');
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  get currentLang(): Lang {
    return this.t.currentLang();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  toggleLang(): void {
    this.t.switchLang(this.currentLang === 'en' ? 'ar' : 'en');
  }

  logout(): void {
    this.auth.logout().subscribe({
      error: () => this.router.navigate(['/']),
    });
  }

  navigateToTab(tabName: string, event: Event): void {
    event.preventDefault();
    this.activeTab = tabName;
    if (tabName === 'home') {
      this.router.navigate(['/']);
    }
  }
}