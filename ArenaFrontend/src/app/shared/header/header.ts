import { Component, inject, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { TranslateModule } from '@ngx-translate/core';

export type DropdownSection = 'profile' | 'workout' | 'diet' | 'membership' | 'progress' | 'settings';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly router = inject(Router);
  protected readonly t = inject(TranslationService);
  public    readonly auth = inject(AuthService);

  private userSub?: Subscription;
  protected readonly displayName = signal('');
  protected readonly profileImage = signal<string | null>(null);

  protected dropdownOpen = false;
  protected readonly currentUser$ = this.auth.currentUser$;
  protected readonly isSubscribed = signal(false);

  protected readonly dropdownItems = [
    { key: 'profile' as const,    label: 'sidebar.dashboard' },
    { key: 'workout' as const,    label: 'sidebar.myWorkouts' },
    { key: 'diet' as const,       label: 'sidebar.myDietPlan' },
    { key: 'membership' as const, label: 'sidebar.membershipBilling' },
    { key: 'progress' as const,   label: 'sidebar.progressReport' },
    { key: 'settings' as const,   label: 'sidebar.settings' },
  ];

  protected isItemDisabled(_item: typeof this.dropdownItems[number]): boolean {
    return !this.isSubscribed();
  }

  ngOnInit(): void {
    this.auth.getMe().subscribe();
    this.userSub = this.auth.currentUser$.subscribe(u => {
      this.displayName.set(u?.firstName ?? '');
      this.profileImage.set(u?.profileImage ?? u?.profileImageUrl ?? null);
      this.isSubscribed.set(u?.isSubscribed ?? false);
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown-container')) {
      this.dropdownOpen = false;
    }
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

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  navigateToSection(section: DropdownSection, event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
    this.router.navigate(['/dashboard'], { queryParams: { section } });
  }

  goToSubscription(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
    this.router.navigate(['/checkout']);
  }

  logout(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }
}