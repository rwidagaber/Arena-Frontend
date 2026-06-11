import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import type { GetProfileDto, UserSubscriptionDto } from '../../core/models/auth';
import type { MemberProfile as MemberProfileModel, MembershipDetails } from '../../core/models/member';
import { DashboardHeader } from './dashboard-header/dashboard-header';
import { StatsOverview, StatItem } from './stats-overview/stats-overview';
import { MembershipSection } from './membership-section/membership-section';
import { RecentWorkouts } from './recent-workouts/recent-workouts';
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
  imports: [
    CommonModule,
    DashboardHeader,
    StatsOverview,
    MembershipSection,
    RecentWorkouts,
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

  stats = computed<StatItem[]>(() => {
    const p = this.profile();
    return [
      {
        label: 'profile.weight',
        value: p?.weight ? `${p.weight} kg` : '—',
        icon: 'fas fa-weight-scale',
      },
      {
        label: 'profile.height',
        value: p?.height ? `${p.height} cm` : '—',
        icon: 'fas fa-ruler',
      },
      {
        label: 'profile.bmi',
        value: p?.bmi ? p.bmi.toFixed(1) : '—',
        icon: 'fas fa-heart-pulse',
      },
      {
        label: 'memberProfile.workouts',
        value: '—',
        icon: 'fas fa-dumbbell',
      },
    ];
  });

  bmiCategory = computed(() => {
    const bmi = this.profile()?.bmi;
    if (bmi == null) return { label: '—', percent: 0 };
    if (bmi < 18.5) return { label: 'Underweight', percent: 25 };
    if (bmi < 25) return { label: 'Normal', percent: 50 };
    if (bmi < 30) return { label: 'Overweight', percent: 75 };
    return { label: 'Obese', percent: 100 };
  });

  bmiProgress = computed(() => {
    const bmi = this.profile()?.bmi;
    if (bmi == null) return 0;
    return Math.min((bmi / 40) * 100, 100);
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

  motivationalMessage = computed(() => {
    const subStart = this.profile()?.activeSubscription?.startDate;
    if (subStart) {
      const start = new Date(subStart).getTime();
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const diff = start - now;
      if (diff > -weekMs && diff < weekMs) return "Let's Grow Together!";
      if (diff < -weekMs) return "You've grown so much since you started!";
    }
    return 'Push harder than yesterday.';
  });

  onSectionChange(section: DashboardSection): void {
    this.activeSection.set(section);
  }

  ngOnInit(): void {
    const cached = this.auth.currentUser$.subscribe(user => {
      if (user && user.firstName) {
        this.profile.set(mapAuthToProfile(user));
        console.log('[Dashboard] Profile set from cache:', user.firstName);
      } else {
        console.log('[Dashboard] Cache skipped - no firstName in cached user:', user);
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
        msg += ' — Check that the backend is running on http://localhost:5095';
        console.error('[Dashboard] getProfile failed:', err);
        this.error.set(msg);
        return of(null);
      })
    ).subscribe(data => {
      console.log('[Dashboard] profile API response:', data);
      if (data) {
        this.profile.set(data);
      }
      this.loading.set(false);
    });
  }
}

export { MemberProfile as ProfileComponent };
