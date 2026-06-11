import { Component, signal, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth';

export type DropdownSection = 'profile' | 'workout' | 'nutrition' | 'bookings' | 'calendar' | 'attendance';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly router = inject(Router);
  protected readonly translate = inject(TranslateService);
  public    readonly auth = inject(AuthService);

  private userSub?: Subscription;

  protected readonly displayName = signal('');
  protected dropdownOpen = false;

  protected readonly dropdownItems: { key: DropdownSection; label: string }[] = [
    { key: 'profile',    label: 'sidebar.profile' },
    { key: 'workout',    label: 'sidebar.workout' },
    { key: 'nutrition',  label: 'sidebar.nutrition' },
    { key: 'bookings',   label: 'sidebar.bookings' },
    { key: 'calendar',   label: 'sidebar.calendar' },
    { key: 'attendance', label: 'sidebar.attendance' },
  ];

  ngOnInit(): void {
    this.userSub = this.auth.currentUser$.subscribe(u => {
      this.displayName.set(u?.firstName ?? '');
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

  get currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  toggleLang(): void {
    const newLang = this.currentLang === 'en' ? 'ar' : 'en';
    this.translate.use(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    localStorage.setItem('arena_lang', newLang);
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