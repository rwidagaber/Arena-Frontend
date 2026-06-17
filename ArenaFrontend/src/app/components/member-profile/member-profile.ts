import { Component, OnInit, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import { ProgressReportService, AttendanceRecord, ProgressSummaryDto } from '../../core/services/progress-report.service';
import type { GetProfileDto, UserSubscriptionDto } from '../../core/models/auth';
import type { MemberProfile as MemberProfileModel, MembershipDetails } from '../../core/models/member';
import { DashboardSidebar, DashboardSection } from './dashboard-sidebar/dashboard-sidebar';
import { RecentWorkouts } from './recent-workouts/recent-workouts';
import { MembershipSection } from './membership-section/membership-section';
import { TranslateModule } from '@ngx-translate/core';
import { QrDisplayComponent } from '../../features/QR/qr-display.component/qr-display.component';
import { ProgressReportComponent } from '../progress-report/progress-report.component';
import { RevealDirective } from '../progress-report/reveal.directive';
import { Nutritionplan } from './nutritionplan/nutritionplan';
import { ThemeService } from '../../core/services/themeservice';
import { WorkoutComponent } from "./workoutplan/workout";

function mapAuthToProfile(dto: GetProfileDto): MemberProfileModel {
  return {
    id: dto.id,
      memberProfileId: dto.memberProfileId ?? dto.id,
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
    RecentWorkouts,
    MembershipSection,
    TranslateModule,
    QrDisplayComponent,
    ProgressReportComponent,
    RevealDirective,
    Nutritionplan,
    WorkoutComponent
],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css',
})
export class MemberProfile implements OnInit {
  private auth = inject(AuthService);
  private memberService = inject(MemberService);
  private progressService = inject(ProgressReportService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private themeService = inject(ThemeService);

  protected Math = Math;

  isDarkMode = computed(() => this.themeService.isDark);

  private readonly svgIcons: Record<string, string> = {
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-3.866 0-7-3.134-7-7 0-3.866 3.134-7 7-7s7 3.134 7 7c0 3.866-3.134 7-7 7z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 8 6 8 6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 16 6 16 6"/><path d="M12 17v3"/><path d="M8 21h8"/><path d="M8 9c0 3.5 2 6 4 6s4-2.5 4-6"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    'calendar-check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  };

  getSvgIcon(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.svgIcons[name] || '');
  }

  profile = signal<MemberProfileModel | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  activeSection = signal<DashboardSection>('profile');

  timeOfDay = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  });

  attendances = signal<AttendanceRecord[]>([]);
  progressSummary = signal<ProgressSummaryDto | null>(null);

  private quotes = [
    { text: 'The only bad workout is the one that didn\'t happen.' },
    { text: 'Strength does not come from the body. It comes from the will.' },
    { text: 'Don\'t limit your challenges. Challenge your limits.' },
    { text: 'The pain you feel today will be the strength you feel tomorrow.' },
    { text: 'Success starts with self-discipline.' },
    { text: 'Your body can stand almost anything. It\'s your mind you have to convince.' },
    { text: 'Believe in yourself and you will be unstoppable.' },
    { text: 'The harder you work, the luckier you get.' },
    { text: 'Wake up with determination. Go to bed with satisfaction.' },
    { text: 'You are stronger than you think.' },
    { text: 'Push yourself because no one else is going to do it for you.' },
    { text: 'The secret of getting ahead is getting started.' },
    { text: 'Great things never come from comfort zones.' },
    { text: 'Dream big. Work hard. Stay focused.' },
    { text: 'Your only limit is your mind.' },
    { text: 'Champions keep playing until they get it right.' },
    { text: 'Take care of your body. It\'s the only place you have to live.' },
    { text: 'The best project you\'ll ever work on is you.' },
  ];

  dailyQuote = computed(() => {
    const n = new Date();
    const diff = n.getTime() - new Date(n.getFullYear(), 0, 0).getTime();
    const dayOfYear = Math.floor(diff / 86400000);
    return this.quotes[dayOfYear % this.quotes.length];
  });

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

  monthlyProgressPercent = computed(() => {
    const s = this.sessionsThisMonth();
    const t = this.monthlyTarget();
    return t > 0 ? Math.min(Math.round((s / t) * 100), 100) : 0;
  });

  streakMilestones = computed(() => [
    { days: 3, label: '3 Days', icon: 'calendar-check', unlocked: this.currentStreak() >= 3 },
    { days: 7, label: '7 Days', icon: 'star', unlocked: this.currentStreak() >= 7 },
    { days: 14, label: '2 Weeks', icon: 'shield', unlocked: this.currentStreak() >= 14 },
    { days: 21, label: '3 Weeks', icon: 'trophy', unlocked: this.currentStreak() >= 21 },
    { days: 30, label: '30 Days', icon: 'crown', unlocked: this.currentStreak() >= 30 },
  ]);

  nextStreakMilestone = computed(() => {
    const s = this.currentStreak();
    const milestones = [3, 7, 14, 21, 30];
    for (const m of milestones) {
      if (s < m) return { target: m, remaining: m - s };
    }
    return null;
  });

  workoutMilestones = computed(() => [
    { count: 10, label: '10 Workouts', icon: '🎯', unlocked: this.totalWorkouts() >= 10 },
    { count: 25, label: '25 Workouts', icon: '⚡', unlocked: this.totalWorkouts() >= 25 },
    { count: 50, label: '50 Workouts', icon: '💎', unlocked: this.totalWorkouts() >= 50 },
    { count: 100, label: '100 Workouts', icon: '👑', unlocked: this.totalWorkouts() >= 100 },
  ]);

  streakMessage = computed(() => {
    const s = this.currentStreak();
    if (s === 0) return { icon: 'bolt', title: 'Ready to start?', subtitle: 'Come in today and begin your streak!' };
    if (s === 1) return { icon: 'fire', title: 'Day 1 — Let\'s go!', subtitle: 'One day down. Make it two!' };
    if (s === 2) return { icon: 'fire', title: '2-Day Streak!', subtitle: 'Momentum is building. Keep showing up!' };
    if (s >= 3 && s < 7) return { icon: 'fire', title: `${s}-Day Streak!`, subtitle: 'You\'re on fire! Consistency is key.' };
    if (s >= 7 && s < 14) return { icon: 'star', title: `${s}-Day Streak!`, subtitle: 'A full week! That\'s championship mindset.' };
    if (s >= 14 && s < 21) return { icon: 'shield', title: `${s}-Day Streak!`, subtitle: 'Two weeks of excellence! Unstoppable.' };
    if (s >= 21 && s < 30) return { icon: 'trophy', title: `${s}-Day Streak!`, subtitle: 'Three weeks! You\'re in the elite zone.' };
    if (s >= 30) return { icon: 'crown', title: `${s}-Day Streak!`, subtitle: '30+ days! Absolutely legendary consistency!' };
    return { icon: 'fire', title: `${s}-Day Streak!`, subtitle: 'Keep the momentum going!' };
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
    const dates = this.getDatesFromAttendance(this.attendances());
    const now = new Date();
    return dates.filter(d => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()).length;
  });

  monthlyTarget = computed(() => this.planMonthlyCap());

  totalWorkouts = computed(() => {
    return this.getDatesFromAttendance(this.attendances()).length;
  });

  currentStreak = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances()).sort((a, b) => b.getTime() - a.getTime());
    if (!dates.length) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    if (dates[0].getTime() < today.getTime()) checkDate.setDate(checkDate.getDate() - 1);
    let streak = 0;
    while (dates.some(d => d.getTime() === checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  });

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

    const bookedDates = this.getDatesFromAttendance(this.attendances())
      .filter(d => d.getFullYear() === year && d.getMonth() === month)
      .map(d => d.getDate());
    const booked = [...new Set(bookedDates)];

    const days: { day: number; isToday: boolean; booked: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, isToday: false, booked: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isToday: d === today, booked: booked.includes(d) });
    }
    return days;
  });

  sparklineData = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const bookedDates = this.getDatesFromAttendance(this.attendances())
      .filter(d => d.getFullYear() === year && d.getMonth() === month)
      .map(d => d.getDate());

    const daily: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      daily.push(bookedDates.includes(d) ? 1 : 0);
    }
    return daily;
  });

  sparklinePath = computed(() => {
    const data = this.sparklineData();
    const w = 120;
    const h = 32;
    const count = data.length;
    if (count === 0) return '';
    const stepX = w / (count - 1 || 1);
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return points.join(' ');
  });

  mostActiveDay = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    if (!dates.length) return null;
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const d of dates) {
      dayCounts[d.getDay()]++;
    }
    const maxIdx = dayCounts.indexOf(Math.max(...dayCounts));
    return { name: dayNames[maxIdx], count: dayCounts[maxIdx] };
  });

  weeklyActivity = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const days: { label: string; active: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        label: labels[i],
        active: dates.some(d => d.getTime() === date.getTime()),
        isToday: date.getTime() === today.getTime(),
      });
    }
    return days;
  });

  weeklySessionCount = computed(() => {
    return this.weeklyActivity().filter(d => d.active).length;
  });

  weekComparison = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);

    let thisWeek = 0;
    let lastWeek = 0;
    for (let i = 0; i < 7; i++) {
      const d1 = new Date(monday);
      d1.setDate(monday.getDate() + i);
      const d2 = new Date(lastMonday);
      d2.setDate(lastMonday.getDate() + i);
      if (dates.some(d => d.getTime() === d1.getTime())) thisWeek++;
      if (dates.some(d => d.getTime() === d2.getTime())) lastWeek++;
    }
    return { thisWeek, lastWeek, change: thisWeek - lastWeek };
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

  sessionsCompletedText = computed(() => {
    const s = this.sessionsThisMonth();
    if (s === 0) return "Ready to crush your first workout today? Let's go!";
    if (s <= 3) return `${s} sessions done this month. Keep building momentum!`;
    if (s <= 10) return `${s} sessions this month. You're on fire!`;
    return `${s} sessions this month. Elite performance!`;
  });

  /* ── Progress Summary derived ── */
  currentBodyFat = computed(() => this.progressSummary()?.currentBodyFat ?? null);
  bodyFatChange = computed(() => this.progressSummary()?.bodyFatChange ?? null);
  currentMuscleMass = computed(() => this.progressSummary()?.currentMuscleMass ?? null);
  muscleMassChange = computed(() => this.progressSummary()?.muscleMassChange ?? null);
  weightChange = computed(() => this.progressSummary()?.weightChange ?? null);

  subscriptionDaysRemaining = computed(() => {
    const sub = this.profile()?.activeSubscription;
    if (!sub?.endDate) return null;
    const end = new Date(sub.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
  });

  lastAttendance = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    if (!dates.length) return null;
    const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
    return sorted[0];
  });

  daysSinceLastWorkout = computed(() => {
    const last = this.lastAttendance();
    if (!last) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - last.getTime()) / 86400000);
  });

  bestStreak = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances()).sort((a, b) => b.getTime() - a.getTime());
    if (!dates.length) return 0;
    const allDates = [...new Set(dates.map(d => d.getTime()))].sort((a, b) => b - a);
    let best = 0, current = 1;
    for (let i = 1; i < allDates.length; i++) {
      const diff = (allDates[i - 1] - allDates[i]) / 86400000;
      if (diff === 1) { current++; } else { best = Math.max(best, current); current = 1; }
    }
    return Math.max(best, current);
  });

  weekdayDistribution = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const d of dates) {
      const idx = d.getDay();
      counts[idx === 0 ? 6 : idx - 1]++;
    }
    const max = Math.max(...counts, 1);
    return labels.map((label, i) => ({ label, count: counts[i], pct: (counts[i] / max) * 100 }));
  });

  weightLogData = computed(() => {
    const logs = this.progressSummary()?.logs ?? [];
    return logs
      .map(l => ({ date: new Date(l.loggedAt), weight: l.weight }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  weightTrendPath = computed(() => {
    const data = this.weightLogData();
    if (data.length < 2) return '';
    const w = 120, h = 32;
    const weights = data.map(d => d.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const stepX = data.length > 1 ? w / (data.length - 1) : w;
    return data.map((d, i) => {
      const x = i * stepX;
      const y = h - ((d.weight - min) / range) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  hasProgressLogs = computed(() => this.weightLogData().length >= 2);

  private getDatesFromAttendance(records: AttendanceRecord[]): Date[] {
    return records
      .filter(r => r.checkInTime)
      .map(r => { const d = new Date(r.checkInTime!); d.setHours(0, 0, 0, 0); return d; })
      .filter((d, i, arr) => arr.findIndex(x => x.getTime() === d.getTime()) === i);
  }

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
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
    });
  }

  ngOnInit(): void {
    const cached = this.auth.currentUser$.subscribe(user => {
      if (user && user.firstName) {
        this.profile.set(mapAuthToProfile(user));
      }
    });
    cached.unsubscribe();

    this.route.queryParams.subscribe(params => {
      const section = params['section'] as DashboardSection | undefined;
      if (section && this.isValidSection(section)) {
        this.activeSection.set(section);
      } else {
        this.activeSection.set('profile');
      }
    });

    this.loadData();
  }

  private isValidSection(s: string): s is DashboardSection {
    return ['profile','qr', 'workout', 'diet', 'membership', 'progress', 'settings'].includes(s);
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
      if (!data) {
        this.loading.set(false);
        return;
      }
      this.profile.set(data);
      const memberProfileId = data.memberProfileId || data.id || '';
      if (!memberProfileId) {
        this.loading.set(false);
        return;
      }
      forkJoin({
        attendances: this.progressService.getAttendances(memberProfileId).pipe(
          catchError(() => of([] as AttendanceRecord[]))
        ),
        progress: this.progressService.getProgress().pipe(
          catchError(() => of(null as ProgressSummaryDto | null))
        ),
      }).subscribe(result => {
        this.attendances.set(result.attendances);
        this.progressSummary.set(result.progress);
        this.loading.set(false);
      });
    });
  }
}

export { MemberProfile as ProfileComponent };
