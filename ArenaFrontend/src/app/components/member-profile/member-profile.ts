import { Component, OnInit, inject, signal, computed, effect, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import { ProgressReportService, AttendanceRecord, ProgressSummaryDto, CreateProgressLogDto } from '../../core/services/progress-report.service';
import { switchMap } from 'rxjs/operators';
import type { GetProfileDto, UserSubscriptionDto } from '../../core/models/auth';
import type { MemberProfile as MemberProfileModel, MembershipDetails, UpdateProfileDto, WorkoutSession } from '../../core/models/member';
import { DashboardSidebar, DashboardSection } from './dashboard-sidebar/dashboard-sidebar';
import { RecentWorkouts } from './recent-workouts/recent-workouts';
import { MembershipSection } from './membership-section/membership-section';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QrDisplayComponent } from '../../features/QR/qr-display.component/qr-display.component';
import { ProgressReportComponent } from '../progress-report/progress-report.component';
import { RevealDirective } from '../progress-report/reveal.directive';
import { Nutritionplan } from './nutritionplan/nutritionplan';
import { ThemeService } from '../../core/services/themeservice';

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
    targetWeight: dto.targetWeight ?? null,
    goal: dto.goal ?? null,
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
  private translate = inject(TranslateService);

  protected Math = Math;

  isDarkMode = computed(() => this.themeService.isDark);

  private readonly svgIcons: Record<string, string> = {
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
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

  private readonly quoteCount = 18;

  /** Translation key for today's rotating motivational quote (memberProfile.quotes.q0..q17). */
  dailyQuoteKey = computed(() => {
    const n = new Date();
    const diff = n.getTime() - new Date(n.getFullYear(), 0, 0).getTime();
    const dayOfYear = Math.floor(diff / 86400000);
    return `memberProfile.quotes.q${dayOfYear % this.quoteCount}`;
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
    { days: 3, labelKey: 'memberProfile.dash.ms3Days', icon: 'calendar-check', unlocked: this.currentStreak() >= 3 },
    { days: 7, labelKey: 'memberProfile.dash.ms7Days', icon: 'star', unlocked: this.currentStreak() >= 7 },
    { days: 14, labelKey: 'memberProfile.dash.ms2Weeks', icon: 'shield', unlocked: this.currentStreak() >= 14 },
    { days: 21, labelKey: 'memberProfile.dash.ms3Weeks', icon: 'trophy', unlocked: this.currentStreak() >= 21 },
    { days: 30, labelKey: 'memberProfile.dash.ms30Days', icon: 'crown', unlocked: this.currentStreak() >= 30 },
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
    if (s === 0) return { icon: 'bolt', titleKey: 'memberProfile.dash.streakReadyTitle', subKey: 'memberProfile.dash.streakReadySub', n: s };
    if (s === 1) return { icon: 'fire', titleKey: 'memberProfile.dash.streakDay1Title', subKey: 'memberProfile.dash.streakDay1Sub', n: s };
    if (s === 2) return { icon: 'fire', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streak2Sub', n: s };
    if (s >= 3 && s < 7) return { icon: 'fire', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streakFireSub', n: s };
    if (s >= 7 && s < 14) return { icon: 'star', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streakWeekSub', n: s };
    if (s >= 14 && s < 21) return { icon: 'shield', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streak2WeekSub', n: s };
    if (s >= 21 && s < 30) return { icon: 'trophy', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streak3WeekSub', n: s };
    if (s >= 30) return { icon: 'crown', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streak30Sub', n: s };
    return { icon: 'fire', titleKey: 'memberProfile.dash.streakTitle', subKey: 'memberProfile.dash.streakKeepSub', n: s };
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

  // Recent gym visits (from real attendance/check-in data) shaped as workout sessions
  recentWorkouts = computed<WorkoutSession[]>(() => {
    return this.attendances()
      .filter(a => a.checkInTime)
      .slice()
      .sort((a, b) => new Date(b.checkInTime!).getTime() - new Date(a.checkInTime!).getTime())
      .slice(0, 6)
      .map(a => ({
        id: a.id,
        name: 'memberProfile.dash.gymSession',
        date: a.checkInTime!,
        durationMinutes: 0,
        caloriesBurned: 0,
        type: 'Check-in',
      }));
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

  private readonly dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  mostActiveDay = computed(() => {
    const dates = this.getDatesFromAttendance(this.attendances());
    if (!dates.length) return null;
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dates) {
      dayCounts[d.getDay()]++;
    }
    const maxIdx = dayCounts.indexOf(Math.max(...dayCounts));
    // Most recent calendar date that falls on the peak weekday
    const peakDate = dates
      .filter(d => d.getDay() === maxIdx)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return { nameKey: `memberProfile.dash.daysFull.${this.dayKeys[maxIdx]}`, date: peakDate };
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

  sessionsCompleted = computed(() => {
    const s = this.sessionsThisMonth();
    if (s === 0) return { key: 'memberProfile.dash.sessionsNone', n: s };
    if (s <= 3) return { key: 'memberProfile.dash.sessionsFew', n: s };
    if (s <= 10) return { key: 'memberProfile.dash.sessionsMid', n: s };
    return { key: 'memberProfile.dash.sessionsElite', n: s };
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
    const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const d of dates) {
      const idx = d.getDay();
      counts[idx === 0 ? 6 : idx - 1]++;
    }
    const max = Math.max(...counts, 1);
    return keys.map((k, i) => ({ labelKey: `memberProfile.dash.days.${k}`, count: counts[i], pct: (counts[i] / max) * 100 }));
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
  savingEdit = signal(false);
  editError = signal<string | null>(null);
  editImage = signal<string | null>(null);
  editGoal = signal('');
  editTargetWeight = signal<number | null>(null);
  editBodyFat = signal<number | null>(null);
  editMuscle = signal<number | null>(null);

  // Fitness goal options (values match the backend MemberProfile.Goal)
  readonly goalOptions = [
    { value: 'WeightLoss', labelKey: 'memberProfile.dash.goalWeightLoss' },
    { value: 'MuscleGain', labelKey: 'memberProfile.dash.goalMuscleGain' },
    { value: 'Endurance', labelKey: 'memberProfile.dash.goalEndurance' },
    { value: 'GeneralFitness', labelKey: 'memberProfile.dash.goalGeneralFitness' },
  ];

  goalLabelKey = computed(() => {
    const g = this.profile()?.goal;
    return this.goalOptions.find(o => o.value === g)?.labelKey ?? null;
  });

  goalDelta = computed(() => {
    const w = this.profile()?.weight;
    const t = this.profile()?.targetWeight;
    if (w == null || t == null) return null;
    const diff = Math.round((w - t) * 10) / 10;
    if (Math.abs(diff) <= 0.5) return { state: 'reached', key: 'memberProfile.dash.goalReached', n: 0 };
    if (diff > 0) return { state: 'lose', key: 'memberProfile.dash.kgToGo', n: diff };
    return { state: 'gain', key: 'memberProfile.dash.kgToGain', n: Math.abs(diff) };
  });

  openEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.editFirstName.set(p.firstName || '');
    this.editLastName.set(p.lastName || '');
    this.editWeight.set(p.weight ?? null);
    this.editHeight.set(p.height ?? null);
    this.editPhone.set(p.phoneNumber || '');
    this.editGender.set(p.gender || '');
    this.editImage.set(p.profileImage ?? null);
    this.editGoal.set(p.goal || '');
    this.editTargetWeight.set(p.targetWeight ?? null);
    this.editBodyFat.set(this.currentBodyFat());
    this.editMuscle.set(this.currentMuscleMass());
    this.editError.set(null);
    this.isEditing.set(true);
  }

  onEditImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.editError.set('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.editError.set('Image is too large (max 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.editImage.set(reader.result as string);
      this.editError.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeEditImage(): void {
    this.editImage.set(null);
  }

  closeEdit(): void {
    if (this.savingEdit()) return;
    this.isEditing.set(false);
    this.editError.set(null);
  }

  saveEdit(): void {
    const p = this.profile();
    if (!p || this.savingEdit()) return;

    const dto: UpdateProfileDto = {
      firstName: this.editFirstName().trim(),
      lastName: this.editLastName().trim(),
      phoneNumber: this.editPhone().trim() || undefined,
      weight: this.editWeight() ?? undefined,
      height: this.editHeight() ?? undefined,
      gender: this.editGender() || undefined,
      profileImage: this.editImage() ?? undefined,
      goal: this.editGoal() || undefined,
      targetWeight: this.editTargetWeight() ?? undefined,
    };

    // Body-composition fields (weight/body fat/muscle) live in the progress log.
    // If any changed, append a new measurement so the dashboard AND the
    // Progress Report page stay in sync with the database.
    const newWeight = this.editWeight();
    const newBodyFat = this.editBodyFat();
    const newMuscle = this.editMuscle();
    const bodyCompChanged =
      (newWeight != null && newWeight !== (p.weight ?? null)) ||
      newBodyFat !== this.currentBodyFat() ||
      newMuscle !== this.currentMuscleMass();
    const logWeight = newWeight ?? p.weight ?? null;
    const progressDto: CreateProgressLogDto | null =
      bodyCompChanged && logWeight != null
        ? { weight: logWeight, bodyFat: newBodyFat, muscleMass: newMuscle }
        : null;

    this.savingEdit.set(true);
    this.editError.set(null);

    // 1) Persist profile fields, then 2) optionally append a progress log.
    this.memberService.updateProfile(dto).pipe(
      switchMap(() => progressDto ? this.progressService.createProgressEntry(progressDto) : of(null))
    ).subscribe({
      next: () => {
        // Re-fetch the canonical profile + progress so derived fields stay accurate
        forkJoin({
          profile: this.memberService.getProfile().pipe(catchError(() => of(null))),
          progress: this.progressService.getProgress().pipe(catchError(() => of(null as ProgressSummaryDto | null))),
        }).subscribe(result => {
          if (result.profile) {
            this.profile.set(result.profile);
          } else {
            // Refresh failed — apply what we sent
            this.profile.set({
              ...p,
              firstName: dto.firstName ?? p.firstName,
              lastName: dto.lastName ?? p.lastName,
              phoneNumber: dto.phoneNumber ?? p.phoneNumber,
              weight: dto.weight ?? p.weight,
              height: dto.height ?? p.height,
              gender: dto.gender ?? p.gender,
              profileImage: dto.profileImage ?? p.profileImage,
              goal: dto.goal ?? p.goal,
              targetWeight: dto.targetWeight ?? p.targetWeight,
            });
          }
          if (result.progress) this.progressSummary.set(result.progress);
          this.savingEdit.set(false);
          this.isEditing.set(false);
        });
      },
      error: (err) => {
        this.savingEdit.set(false);
        const e = err?.error;
        const msg = Array.isArray(e) ? e.join(', ')
          : typeof e === 'string' ? e
          : e?.message ?? e?.title ?? err?.message;
        // Surface the real backend reason (e.g. validation / DB errors) instead of a generic message
        console.error('Profile save failed:', err?.status, e);
        this.editError.set(msg || this.translate.instant('memberProfile.dash.saveFailed'));
      },
    });
  }

  // ════════ Celebration modal (streak / achievement) ════════
  showCelebration = signal(false);
  confettiPieces = Array.from({ length: 32 }, (_, i) => ({
    left: (i * 7 + (i % 5) * 11) % 100,
    delay: (i % 8) * 0.13,
    duration: 2.3 + (i % 5) * 0.45,
    color: ['#C6EF2E', '#38BDF8', '#A78BFA', '#FB7185', '#FBBF24'][i % 5],
    size: 6 + (i % 4) * 3,
    round: i % 3 === 0,
  }));

  openCelebration(): void { this.showCelebration.set(true); }
  closeCelebration(): void { this.showCelebration.set(false); }

  // Auto-pop once when a new streak milestone is reached
  private celebratedStreak = 0;
  private celebrationEffect = effect(() => {
    const s = this.currentStreak();
    const milestones = [1, 2, 3, 7, 14, 21, 30, 60, 100];
    if (!milestones.includes(s)) return;
    if (s > this.celebratedStreak) {
      this.celebratedStreak = s;
      setTimeout(() => this.showCelebration.set(true), 700);
    }
  });

  // ════════ Stat detail modal ════════
  activeStat = signal<string | null>(null);
  openStat(key: string): void { this.activeStat.set(key); }
  closeStat(): void { this.activeStat.set(null); }

  private daysAgoLabel(): string {
    const d = this.daysSinceLastWorkout();
    if (d == null) return '—';
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    return `${d} days ago`;
  }

  statDetail = computed(() => {
    const key = this.activeStat();
    if (!key) return null;
    const rem = this.subscriptionDaysRemaining();
    const map: Record<string, { title: string; value: string; accent: string; rows: { label: string; value: string }[] }> = {
      workouts: {
        title: 'Total Workouts', value: `${this.totalWorkouts()}`, accent: '#C6EF2E',
        rows: [
          { label: 'This month', value: `${this.sessionsThisMonth()}` },
          { label: 'Current streak', value: `${this.currentStreak()} days` },
          { label: 'Best streak', value: `${this.bestStreak()} days` },
        ],
      },
      streak: {
        title: 'Current Streak', value: `${this.currentStreak()}d`, accent: '#FB7185',
        rows: [
          { label: 'Best streak', value: `${this.bestStreak()} days` },
          { label: 'Last visit', value: this.daysAgoLabel() },
          { label: 'Total workouts', value: `${this.totalWorkouts()}` },
        ],
      },
      best: {
        title: 'Best Streak', value: `${this.bestStreak()}d`, accent: '#A78BFA',
        rows: [
          { label: 'Current streak', value: `${this.currentStreak()} days` },
          { label: 'Total workouts', value: `${this.totalWorkouts()}` },
          { label: 'Last visit', value: this.daysAgoLabel() },
        ],
      },
      month: {
        title: 'This Month', value: `${this.sessionsThisMonth()}/${this.monthlyTarget()}`, accent: '#38BDF8',
        rows: [
          { label: 'Completed', value: `${this.sessionsThisMonth()}` },
          { label: 'Monthly target', value: `${this.monthlyTarget()}` },
          { label: 'Remaining', value: `${Math.max(0, this.monthlyTarget() - this.sessionsThisMonth())}` },
        ],
      },
      plan: {
        title: 'Plan', value: rem != null ? `${rem}d` : '—', accent: '#FBBF24',
        rows: [
          { label: 'Days remaining', value: rem != null ? `${rem}` : '—' },
          { label: 'This month', value: `${this.sessionsThisMonth()} / ${this.monthlyTarget()}` },
        ],
      },
    };
    return map[key] ?? null;
  });

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
    return ['profile', 'qr', 'workout', 'diet', 'membership', 'progress', 'settings'].includes(s);
  }

  userSubscriptions = signal<UserSubscriptionDto[]>([]);
  loadingSubscriptions = signal(false);

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
      this.loadSubscriptions(data.memberProfileId);
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

  loadSubscriptions(memberProfileId: string): void {
    this.loadingSubscriptions.set(true);
    this.memberService.getUserSubscriptions(memberProfileId).pipe(
      catchError(err => {
        console.error('Failed to load subscriptions', err);
        return of([]);
      })
    ).subscribe(subs => {
      this.userSubscriptions.set(subs);
      this.loadingSubscriptions.set(false);
    });
  }
}

export { MemberProfile as ProfileComponent };
