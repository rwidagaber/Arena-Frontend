import { Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth';
import { MemberService } from '../../../core/services/member.service';
import { TranslateModule } from '@ngx-translate/core';
import { AvatarCropperComponent } from './avatar-cropper';

export type DashboardSection = 'profile' | 'qr' | 'workout' | 'diet' | 'membership' | 'progress' | 'settings' | 'mybookings';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [TranslateModule, AvatarCropperComponent],
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.css',
})
export class DashboardSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);
  private member = inject(MemberService);

  readonly activeSection = input<DashboardSection>('profile');
  readonly sectionChange = output<DashboardSection>();

  readonly planName = input<string | null>(null);
  readonly planLevel = input<string>('');
  readonly expiryDate = input<string | null>(null);
  readonly membershipProgress = input<number>(0);
  readonly remainingSessions = input<number | null>(null);
  readonly daysRemaining = input<number>(0);
  readonly hasSubscription = input<boolean>(false);
  readonly profileImage = input<string | null>(null);
  readonly firstName = input<string>('');
  readonly lastName = input<string>('');

  readonly isMobileOpen = input<boolean>(false);
  readonly closeMobile = output<void>();

  /* ── Member header (self-sourced from the signed-in user) ──────── */
  private readonly user = toSignal(this.auth.currentUser$, { initialValue: null });

  get displayName(): string {
    const u = this.user() as { firstName?: string; lastName?: string } | null;
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Member';
  }

  get initials(): string {
    const u = this.user() as { firstName?: string; lastName?: string } | null;
    const a = (u?.firstName ?? '').charAt(0);
    const b = (u?.lastName ?? '').charAt(0);
    return (a + b).toUpperCase() || 'M';
  }

  /** Prefers a just-saved local image, then an input, then the stored avatar. */
  get avatarUrl(): string | null {
    const u = this.user() as { profileImage?: string; profileImageUrl?: string } | null;
    return this.localAvatar() ?? this.profileImage() ?? u?.profileImage ?? u?.profileImageUrl ?? null;
  }

  /* ── Avatar upload + crop ──────────────────────────────────────── */
  /** Optimistic local override so the new photo shows immediately. */
  protected readonly localAvatar = signal<string | null>(null);
  /** Source image being cropped; non-null opens the cropper modal. */
  protected readonly cropSrc = signal<string | null>(null);
  protected readonly uploading = signal(false);

  /** File picked → read it and open the cropper. */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) return; // 8 MB cap before cropping
    const reader = new FileReader();
    reader.onload = () => this.cropSrc.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  /** Cropper produced a square image → show it and persist. */
  protected onCropped(dataUrl: string): void {
    this.cropSrc.set(null);
    this.localAvatar.set(dataUrl);
    this.auth.patchCurrentUser({ profileImage: dataUrl });
    this.persistAvatar(dataUrl);
  }

  protected onCropCancel(): void {
    this.cropSrc.set(null);
  }

  /** Re-send the existing profile with the new image so no field is lost. */
  private persistAvatar(dataUrl: string): void {
    this.uploading.set(true);
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
        this.uploading.set(false);
        const img = saved?.profileImage ?? dataUrl;
        this.localAvatar.set(img);
        this.auth.patchCurrentUser({ profileImage: img });
      },
      error: () => this.uploading.set(false),
    });
  }

  readonly items: { key: DashboardSection; icon: string; label: string }[] = [
    { key: 'profile',    icon: 'grid',       label: 'My Profile' },
    { key: 'mybookings', icon: 'calendar',   label: 'myBookings' },
    { key: 'qr',         icon: 'qr',         label: 'QR Codes' },
    { key: 'workout',    icon: 'dumbbell',   label: 'sidebar.myWorkouts' },
    { key: 'diet',       icon: 'utensils',   label: 'sidebar.myDietPlan' },
    { key: 'membership', icon: 'shield',     label: 'sidebar.membershipBilling' },
    { key: 'progress',   icon: 'chart',      label: 'sidebar.progressReport' },
  ];

  select(section: DashboardSection, event?: MouseEvent): void {
    this.sectionChange.emit(section);
    // On the desktop hover-drawer, a mouse click leaves focus on the button,
    // which keeps :focus-within (and the drawer) open until you click away.
    // Release focus for pointer activation so it closes on mouse-leave; keep
    // focus for keyboard activation (event.detail === 0) for accessibility.
    if (event && event.detail !== 0) {
      (event.currentTarget as HTMLElement | null)?.blur();
    }
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }
}
