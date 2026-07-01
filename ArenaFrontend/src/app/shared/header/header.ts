import { Component, inject, OnInit, OnDestroy, HostListener, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, switchMap, catchError, of } from 'rxjs';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/themeservice';
import { NotificationBellComponent } from "../../features/notifications/notification-bell/notification-bell";
import { NotificationToastComponent } from "../../features/notifications/notification-toast/notification-toast";
import { WebPushService } from '../../core/services/web-push.service';
import { AvatarCropperComponent } from '../../components/member-profile/dashboard-sidebar/avatar-cropper';

export type DropdownSection = 'profile' | 'workout' | 'diet' | 'membership' | 'progress' | 'settings';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule, NotificationBellComponent, NotificationToastComponent, AvatarCropperComponent],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly webPush = inject(WebPushService);
  protected readonly router = inject(Router);
  protected readonly t = inject(TranslationService);
  public    readonly auth = inject(AuthService);
  private   readonly member = inject(MemberService);
  readonly themeService = inject(ThemeService);

  protected readonly uploadingAvatar = signal(false);

  protected isSticky = false;
  protected scrollProgress = 0;

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isSticky = window.scrollY > 80;
    // Reading progress indicator (additive — does not affect sticky logic)
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    this.scrollProgress = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
  }

  /* ── Mobile navigation menu ──────────────────────────────────── */
  protected mobileOpen = false;

  toggleMobileMenu(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  closeMobileMenu(): void {
    this.mobileOpen = false;
  }

  private userSub?: Subscription;
  protected readonly displayName = signal('');
  protected readonly profileImage = signal<string | null>(null);

  /** Full name for the account dropdown, with a graceful fallback. */
  protected memberName(u: { firstName?: string | null; lastName?: string | null } | null): string {
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Member';
  }

  protected dropdownOpen = false;
   @Input() activeTab: string = 'home';

  protected readonly currentUser$ = this.auth.currentUser$;
  protected readonly isSubscribed = signal(false);


  ngOnInit(): void {
    this.userSub = this.auth.currentUser$.subscribe(u => {
      this.displayName.set(u?.firstName ?? '');
      this.isSubscribed.set(u?.isSubscribed ?? false);
      if (!u) { this.profileImage.set(null); return; }
      // Only set when present so a /me payload without the image doesn't clobber it.
      const img = u.profileImage ?? u.profileImageUrl ?? null;
      if (img) this.profileImage.set(img);
       this.webPush.requestPermissionAndSubscribe();
    });

    // ✅ لا تحاول تجيب /me أو /profile إلا لو المستخدم فعليًا مسجل دخول.
    // بدون الشرط ده، أي صفحة عامة (زي reset-password) بتاخد 401 من /me،
    // فيتفعّل refresh token attempt يفشل هو كمان، ويعمل clearSession + navigate('/')
    // قسريًا حتى لو المستخدم أصلاً في صفحة صحيحة ومسموح له بيها.
    if (this.auth.isLoggedIn) {
      this.auth.getMe().pipe(
        catchError(() => of(null)),
        switchMap(() => this.member.getProfile().pipe(catchError(() => of(null))))
      ).subscribe(p => {
        const img = p?.profileImage;
        if (img) {
          this.profileImage.set(img);
          this.auth.patchCurrentUser({ profileImage: img });
        }
      });
    }
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

  goToHelp(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
    this.router.navigate(['/contact']);
  }

  logout(event: Event): void {
    event.stopPropagation();
    this.dropdownOpen = false;
       this.webPush.unsubscribe();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }

  toggleTheme(): void {
  const isDark = this.themeService.isDark;
  this.themeService.setTheme(isDark ? 'light' : 'dark');
}

  /* ── Profile image upload (from the header avatar) ──────────────── */
  /** Source image being cropped; non-null opens the shared cropper modal. */
  protected readonly cropSrc = signal<string | null>(null);

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) return; // 8 MB before cropping
    const reader = new FileReader();
    reader.onload = () => this.cropSrc.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  /** Cropper produced a square image → optimistic update + persist. */
  protected onAvatarCropped(dataUrl: string): void {
    this.cropSrc.set(null);
    this.profileImage.set(dataUrl);
    this.auth.patchCurrentUser({ profileImage: dataUrl });
    this.persistAvatar(dataUrl);
  }

  protected onAvatarCropCancel(): void {
    this.cropSrc.set(null);
  }

  /** Re-send the existing profile with the new image so no other field is lost. */
  private persistAvatar(dataUrl: string): void {
    this.uploadingAvatar.set(true);
    this.member.getProfile().pipe(
      switchMap(p => this.member.updateProfile({
        firstName: p.firstName,
        lastName: p.lastName,
        phoneNumber: p.phoneNumber ?? undefined,
        weight: p.weight ?? undefined,
        height: p.height ?? undefined,
        gender: p.gender ?? undefined,
        goal: p.goal ?? undefined,
        targetWeight: p.targetWeight ?? undefined,
        profileImage: dataUrl,
      }))
    ).subscribe({
      next: (saved) => {
        this.uploadingAvatar.set(false);
        // Use the value the server saved; fall back to the uploaded data URL.
        const img = saved?.profileImage ?? dataUrl;
        this.profileImage.set(img);
        // Patch the cached user so the dropdown header avatar updates too
        // (/me does not always echo profileImage back).
        this.auth.patchCurrentUser({ profileImage: img });
      },
      error: (err) => {
        this.uploadingAvatar.set(false);
        console.error('Avatar upload failed:', err?.status, err?.error ?? err?.message ?? err);
      },
    });
  }
}