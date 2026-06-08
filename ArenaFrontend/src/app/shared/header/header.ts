import { Component, signal, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { TranslatePipe } from '../pipes/translate.pipe';

export type DropdownSection = 'profile' | 'workout' | 'nutrition' | 'bookings' | 'calendar' | 'attendance';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly router = inject(Router);
  readonly t = inject(TranslationService);
  readonly auth = inject(AuthService);
  private userSub?: Subscription;

  protected readonly displayName = signal('');
  protected dropdownOpen = false;

  protected readonly dropdownItems: { key: DropdownSection; label: string }[] = [
    { key: 'profile',   label: 'sidebar.profile' },
    { key: 'workout',   label: 'sidebar.workout' },
    { key: 'nutrition', label: 'sidebar.nutrition' },
    { key: 'bookings',  label: 'sidebar.bookings' },
    { key: 'calendar',  label: 'sidebar.calendar' },
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
      error: () => this.router.navigate(['/']),
    });
  }

}