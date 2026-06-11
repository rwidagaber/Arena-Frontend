import { Component, OnInit, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import type { GetProfileDto, UserSubscriptionDto } from '../../core/models/auth';
import type { MemberProfile as MemberProfileModel, MembershipDetails } from '../../core/models/member';
import { DashboardSidebar, DashboardSection } from './dashboard-sidebar/dashboard-sidebar';
import { TranslateModule } from '@ngx-translate/core';

function mapAuthToProfile(dto: GetProfileDto): MemberProfileModel {
  return {
    id: dto.id,
    memberProfileId: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    phoneNumber: dto.phoneNumber ?? null,
    preferredLanguage: dto.preferredLanguage,
    isActive: dto.isActive ?? true,
    weight: dto.weight ?? null,
    height: dto.height ?? null,
    bmi: dto.bmi ?? null,
    gender: dto.gender ?? null,
    profileImage: dto.profileImage ?? null,
    birthday: dto.birthday ?? null,
    activeSubscription: dto.activeSubscription ?? null,
  };
}

function mapSubscriptionToMembership(sub: UserSubscriptionDto): MembershipDetails {
  return {
    type: sub.planNameEn,
    startDate: sub.startDate,
    endDate: sub.endDate,
    isActive: sub.status === 'Active',
    price: 0,
    features: [],
  };
}

@Component({
  selector: 'app-member-profile',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    DashboardSidebar,
    TranslateModule,
  ],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css',
})
export class MemberProfile implements OnInit {
  private auth = inject(AuthService);
  private memberService = inject(MemberService);

  profile = signal<MemberProfileModel | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  activeSection = signal<DashboardSection>('profile');

  mappedMembership = computed<MembershipDetails | null>(() => {
    const sub = this.profile()?.activeSubscription;
    return sub ? mapSubscriptionToMembership(sub) : null;
  });

  planLevel = computed(() => {
    const sub = this.profile()?.activeSubscription;
    if (!sub) return '';
    return sub.planNameEn || '';
  });

  planName = computed(() => {
    const level = this.planLevel();
    return level || 'Member';
  });

  planMonthlyCap = computed(() => {
    const level = this.planLevel();
    if (level.toLowerCase().includes('platinum')) return 30;
    if (level.toLowerCase().includes('gold')) return 20;
    if (level.toLowerCase().includes('silver')) return 15;
    if (level.toLowerCase().includes('bronze')) return 10;
    return 20;
  });

  sessionsRemaining = computed(() => {
    const sub = this.profile()?.activeSubscription;
    if (!sub || sub.remainingSessions == null) return null;
    return sub.remainingSessions;
  });

  sessionsThisMonth = computed(() => {
    const cap = this.planMonthlyCap();
    const rem = this.sessionsRemaining();
    if (rem != null) return Math.max(0, cap - rem);
    return 12;
  });

  monthlyTarget = computed(() => this.planMonthlyCap());

  totalWorkouts = computed(() => 12);
  currentStreak = computed(() => 12);

  age = computed(() => {
    const b = this.profile()?.birthday;
    if (!b) return null;
    const birth = new Date(b);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });

  calendarDays = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const booked: number[] = [5, 8, 12, 15, 19, 22, 26];

    const days: { day: number; isToday: boolean; booked: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, isToday: false, booked: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isToday: d === today, booked: booked.includes(d) });
    }
    return days;
  });

  membershipProgress = computed(() => {
    const sub = this.profile()?.activeSubscription;
    if (!sub?.startDate || !sub?.endDate) return 0;
    const start = new Date(sub.startDate).getTime();
    const end = new Date(sub.endDate).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  });

  sessionsCompletedText = computed(() =>
    `You've completed ${this.sessionsThisMonth()} sessions this month. You're doing amazing!`
  );

  isEditing = signal(false);
  editFirstName = signal('');
  editLastName = signal('');
  editWeight = signal<number | null>(null);
  editHeight = signal<number | null>(null);
  editPhone = signal('');
  editGender = signal('');

  openEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.editFirstName.set(p.firstName || '');
    this.editLastName.set(p.lastName || '');
    this.editWeight.set(p.weight ?? null);
    this.editHeight.set(p.height ?? null);
    this.editPhone.set(p.phoneNumber || '');
    this.editGender.set(p.gender || '');
    this.isEditing.set(true);
  }

  closeEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    const p = this.profile();
    if (!p) return;
    const updated: MemberProfileModel = {
      ...p,
      firstName: this.editFirstName(),
      lastName: this.editLastName(),
      weight: this.editWeight(),
      height: this.editHeight(),
      phoneNumber: this.editPhone(),
      gender: this.editGender(),
    };
    this.profile.set(updated);
    this.isEditing.set(false);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const p = this.profile();
      if (p && reader.result) {
        this.profile.set({ ...p, profileImage: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  }

  onSectionChange(section: DashboardSection): void {
    this.activeSection.set(section);
  }

  ngOnInit(): void {
    const cached = this.auth.currentUser$.subscribe(user => {
      if (user && user.firstName) {
        this.profile.set(mapAuthToProfile(user));
      }
    });
    cached.unsubscribe();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.memberService.getProfile().pipe(
      catchError(err => {
        let msg = 'Failed to load profile';
        if (err?.status) msg += ` (HTTP ${err.status})`;
        if (err?.message) msg += `: ${err.message}`;
        this.error.set(msg);
        return of(null);
      })
    ).subscribe(data => {
      if (data) {
        this.profile.set(data);
      }
      this.loading.set(false);
    });
  }
}

export { MemberProfile as ProfileComponent };
