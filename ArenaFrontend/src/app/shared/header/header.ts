import { Component, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { TranslatePipe } from '../pipes/translate.pipe';

export type DropdownSection = 'profile' | 'workout' | 'diet' | 'membership' | 'progress' | 'settings';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  protected readonly router = inject(Router);
  protected readonly t = inject(TranslationService);
  public    readonly auth = inject(AuthService);

  protected dropdownOpen = false;
  protected readonly currentUser$ = this.auth.currentUser$;

  protected readonly dropdownItems: { key: DropdownSection; label: string }[] = [
    { key: 'profile',    label: 'sidebar.dashboard' },
    { key: 'workout',    label: 'sidebar.myWorkouts' },
    { key: 'diet',       label: 'sidebar.myDietPlan' },
    { key: 'membership', label: 'sidebar.membershipBilling' },
    { key: 'progress',   label: 'sidebar.progressReport' },
    { key: 'settings',   label: 'sidebar.settings' },
  ];

  ngOnInit(): void {
    this.auth.getMe().subscribe();
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

  navigateToSection(section: DropdownSection): void {
    this.dropdownOpen = false;
    this.router.navigate(['/dashboard'], { queryParams: { section } });
  }

  goToSubscription(): void {
    this.dropdownOpen = false;
    this.router.navigate(['/subscription']);
  }

  logout(): void {
    this.dropdownOpen = false;
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }
}
