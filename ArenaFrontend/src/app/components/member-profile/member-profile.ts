import { Component, OnInit, inject, signal, computed, effect, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { MemberService } from '../../core/services/member.service';
import { ProgressReportService, AttendanceRecord, ProgressSummaryDto, CreateProgressLogDto } from '../../core/services/progress-report.service';
import { switchMap } from 'rxjs/operators';
import type { GetProfileDto, UserSubscriptionDto } from '../../core/models/auth';
import type { MemberProfile as MemberProfileModel, UpdateProfileDto, WorkoutSession } from '../../core/models/member';
import { DashboardSidebar, DashboardSection } from './dashboard-sidebar/dashboard-sidebar';
import { MembershipSection } from './membership-section/membership-section';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { QrDisplayComponent } from '../../features/QR/qr-display.component/qr-display.component';
import { ProgressReportComponent } from '../progress-report/progress-report.component';
import { RevealDirective } from '../progress-report/reveal.directive';
import { Nutritionplan } from './nutritionplan/nutritionplan';
import { ThemeService } from '../../core/services/themeservice';
import { TranslationService, type Lang } from '../../core/services/translation.service';
import { WorkoutComponent } from "./workoutplan/workout";
import { WorkoutService } from '../../core/services/workout';
import { NutritionService } from '../../core/services/nutrition';
import type { NutritionPlanDto } from '../../core/models/nutrition';
import type { WorkoutPlanDto } from '../../core/models/workout';
import { BookingSection } from './booking-section/booking-section';
import { BookingService } from '../../core/services/booking.service';
import type { BookingDto } from '../../core/models/booking';


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

@Component({
  selector: 'app-member-profile',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    DashboardSidebar,
    MembershipSection,
    TranslateModule,
    QrDisplayComponent,
    ProgressReportComponent,
    RevealDirective,
    Nutritionplan,
    WorkoutComponent,

    BookingSection,
],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css',
})
export class MemberProfile implements OnInit {
  private auth = inject(AuthService);
  private memberService = inject(MemberService);
  private progressService = inject(ProgressReportService);
  private bookingService = inject(BookingService);
  private workoutSvc = inject(WorkoutService);
  private nutritionSvc = inject(NutritionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private themeService = inject(ThemeService);
  private i18n = inject(TranslationService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);

  protected Math = Math;

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
  // Secondary (attendance/progress-derived) data loads after the profile; the
  // shell renders on `loading`, the streak/achievements wait on `statsLoading`.
  statsLoading = signal(true);

  /** Active workout plan — source for the "Working Weights" board. */
  workoutPlan = signal<WorkoutPlanDto | null>(null);
  loadingWorkoutPlan = signal(false);

  /** Active nutrition plan — feeds the AI teaser's macro targets. */
  nutritionPlan = signal<NutritionPlanDto | null>(null);

  /** Heaviest working weights from the active plan: dedupe by exercise, keep the
      heaviest set, sort desc, take the top 4. These are program working targets
      (trainer-prescribed weights), NOT logged personal records. */
  mainLifts = computed(() => {
    const plan = this.workoutPlan();
    type Lift = { name: string; weight: number; sets: number; reps: number; muscleGroup: string | null };
    if (!plan?.days?.length) return [] as Lift[];
    const best = new Map<string, Lift>();
    for (const day of plan.days) {
      for (const ex of day.exercises ?? []) {
        const weight = ex.weight ?? 0;
        if (weight <= 0) continue;
        const name = (ex.exercise?.name ?? ex.name ?? '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const prev = best.get(key);
        if (!prev || weight > prev.weight) {
          best.set(key, { name, weight, sets: ex.sets, reps: ex.reps, muscleGroup: ex.muscleGroup ?? ex.exercise?.muscleGroup ?? null });
        }
      }
    }
    return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, 4);
  });

  hasMainLifts = computed(() => this.mainLifts().length > 0);

  /** Today's suggested session from the active plan. The plan's days aren't
      bound to calendar weekdays, so we rotate through them by day-of-week to
      give a stable "today" suggestion. Returns null when there's no plan. */
  todaysWorkout = computed(() => {
    const plan = this.workoutPlan();
    if (!plan?.days?.length) return null;
    const day = plan.days[new Date().getDay() % plan.days.length];
    const exercises = day.exercises ?? [];
    const muscles = [...new Set(
      exercises.map(e => (e.muscleGroup ?? e.exercise?.muscleGroup ?? '').trim()).filter(Boolean)
    )].slice(0, 3);
    const preview = exercises
      .map(e => (e.exercise?.name ?? e.name ?? '').trim())
      .filter(Boolean)
      .slice(0, 3);
    return { dayName: day.dayName, count: exercises.length, muscles, preview };
  });

  /** Real workout snippet for the AI teaser: today's day from the active plan
   *  (falling back to the first day that has exercises), with up to 3 exercises
   *  and their prescribed sets × reps. Null when the member has no plan yet. */
  teaserWorkout = computed(() => {
    const plan = this.workoutPlan();
    if (!plan?.days?.length) return null;
    const todayIdx = new Date().getDay() % plan.days.length;
    const ordered = [plan.days[todayIdx], ...plan.days];
    for (const day of ordered) {
      const exercises = (day.exercises ?? [])
        .map(e => ({ name: (e.exercise?.name ?? e.name ?? '').trim(), sets: e.sets, reps: e.reps }))
        .filter(e => e.name)
        .slice(0, 3);
      if (exercises.length) return { dayName: day.dayName, exercises };
    }
    return null;
  });

  /** True when the member has already checked in today. */
  trainedToday = computed(() => this.daysSinceLastWorkout() === 0);

  private readonly quoteCount = 18;

  /** Translation key for today's rotating motivational quote (memberProfile.quotes.q0..q17). */
  dailyQuoteKey = computed(() => {
    const n = new Date();
    const diff = n.getTime() - new Date(n.getFullYear(), 0, 0).getTime();
    const dayOfYear = Math.floor(diff / 86400000);
    return `memberProfile.quotes.q${dayOfYear % this.quoteCount}`;
  });

  planLevel = computed(() => {
    const sub = this.profile()?.activeSubscription;
    if (!sub) return '';
    return sub.planNameEn || '';
  });

  /** True when the member's active plan includes AI features. Drives whether the
   *  AI-subscription teaser card is shown (we show it only when they don't). */
  hasAI = computed(() => !!this.profile()?.activeSubscription?.hasAI);

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
    { count: 10, labelKey: 'memberProfile.dash.wmWorkouts', icon: '🎯', unlocked: this.totalWorkouts() >= 10 },
    { count: 25, labelKey: 'memberProfile.dash.wmWorkouts', icon: '⚡', unlocked: this.totalWorkouts() >= 25 },
    { count: 50, labelKey: 'memberProfile.dash.wmWorkouts', icon: '💎', unlocked: this.totalWorkouts() >= 50 },
    { count: 100, labelKey: 'memberProfile.dash.wmWorkouts', icon: '👑', unlocked: this.totalWorkouts() >= 100 },
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

  /** Member bookings (used to surface the next upcoming session on the dashboard). */
  bookings = signal<BookingDto[]>([]);
  loadingBookings = signal(false);

  private isConfirmed(b: BookingDto): boolean {
    return b.status === 1 || b.status === '1' || b.status === 'Confirmed';
  }

  /** Soonest upcoming confirmed booking, with a friendly day-kind for labelling. */
  nextSession = computed(() => {
    const now = Date.now();
    const upcoming = this.bookings()
      .filter(b => this.isConfirmed(b))
      .map(b => {
        let when = NaN;
        try { when = new Date(`${b.bookingDate.split('T')[0]}T${b.startTime}`).getTime(); } catch { /* skip unparseable */ }
        return { when };
      })
      .filter(x => !Number.isNaN(x.when) && x.when > now)
      .sort((a, b) => a.when - b.when);
    const first = upcoming[0];
    if (!first) return null;
    const date = new Date(first.when);
    const diffDays = Math.round((this.startOfDay(date) - this.startOfDay(new Date())) / 86400000);
    const dayKind: 'today' | 'tomorrow' | 'other' = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : 'other';
    return { date, dayKind };
  });

  /* ════════════════════════════════════════════════════════════════
     MOTIVATION — features that nudge the member back to the gym.
     All derived from existing attendance / progress / booking signals.
     ════════════════════════════════════════════════════════════════ */

  // ── Rest-day freeze (1 forgiveness token per calendar month, localStorage) ──
  private freezeKeyFor(d = new Date()): string {
    return `arena_freeze_${d.getFullYear()}-${d.getMonth()}`;
  }
  frozenDates = signal<number[]>(this.loadFrozenDates());
  private loadFrozenDates(): number[] {
    try {
      const raw = localStorage.getItem(this.freezeKeyFor());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  /** One token per month; spent once any freeze exists this month. */
  freezeAvailable = computed(() => this.frozenDates().length === 0);
  frozenToday = computed(() => this.frozenDates().includes(this.startOfDay(new Date())));
  useFreeze(): void {
    if (!this.freezeAvailable()) return;
    const next = [...this.frozenDates(), this.startOfDay(new Date())];
    this.frozenDates.set(next);
    try { localStorage.setItem(this.freezeKeyFor(), JSON.stringify(next)); } catch { /* ignore */ }
  }

  /** Check-in days plus any frozen (rest-day-pass) days — used for streak math only. */
  private streakDays = computed<Date[]>(() => {
    const set = new Set(this.attendanceDays().map(d => d.getTime()));
    for (const t of this.frozenDates()) set.add(t);
    return [...set].map(t => new Date(t));
  });

  // ── #1 Streak at risk: have a live streak but haven't shown up today ──
  streakAtRisk = computed(() => {
    const s = this.currentStreak();
    const d = this.daysSinceLastWorkout();
    return s > 0 && !this.frozenToday() && d != null && d >= 1;
  });

  // ── #3 Weekly commitment goal (persisted target, 1–7 sessions/week) ──
  private readonly weeklyTargetKey = 'arena_weekly_target';
  weeklyTarget = signal<number>(this.loadWeeklyTarget());
  private loadWeeklyTarget(): number {
    try { const v = Number(localStorage.getItem(this.weeklyTargetKey)); return v >= 1 && v <= 7 ? v : 3; }
    catch { return 3; }
  }
  setWeeklyTarget(n: number): void {
    const v = Math.min(7, Math.max(1, Math.round(n)));
    this.weeklyTarget.set(v);
    try { localStorage.setItem(this.weeklyTargetKey, String(v)); } catch { /* ignore */ }
  }
  weeklyGoalPercent = computed(() => {
    const t = this.weeklyTarget();
    return t > 0 ? Math.min(100, Math.round((this.weeklySessionCount() / t) * 100)) : 0;
  });
  weeklyGoalMet = computed(() => this.weeklySessionCount() >= this.weeklyTarget());

  // ── #5 Personal records (from attendance + progress logs) ──
  personalRecords = computed(() => {
    const days = this.attendanceDays();
    const monthCounts = new Map<string, number>();
    for (const d of days) {
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
    }
    const bestMonth = monthCounts.size ? Math.max(...monthCounts.values()) : 0;
    const weights = this.weightLogData().map(d => d.weight);
    return {
      bestStreak: this.bestStreak(),
      bestMonth,
      lowestWeight: weights.length ? Math.min(...weights) : null,
    };
  });

  // ── #6 Goal ETA: project when target weight is reached at current pace ──
  goalEta = computed<{ reached: boolean; date: Date | null }>(() => {
    const data = this.weightLogData(); // ascending by date
    const target = this.profile()?.targetWeight;
    if (target == null || data.length < 2) return { reached: false, date: null };
    const first = data[0];
    const last = data[data.length - 1];
    const spanDays = (last.date.getTime() - first.date.getTime()) / 86400000;
    if (spanDays <= 0) return { reached: false, date: null };
    const remaining = target - last.weight;
    if (Math.abs(remaining) < 0.1) return { reached: true, date: null };
    const ratePerDay = (last.weight - first.weight) / spanDays;
    // Only project if the trend is actually moving toward the target
    if (ratePerDay === 0 || Math.sign(ratePerDay) !== Math.sign(remaining)) return { reached: false, date: null };
    const daysToGo = remaining / ratePerDay;
    if (daysToGo <= 0 || daysToGo > 3650) return { reached: false, date: null };
    return { reached: false, date: new Date(last.date.getTime() + daysToGo * 86400000) };
  });

  /** Personalized one-line nudge shown above the daily quote. */
  motivationNudge = computed<{ key: string; params?: Record<string, unknown> }>(() => {
    if (this.streakAtRisk()) return { key: 'memberProfile.dash.nudgeRisk' };
    if (this.weeklyGoalMet()) return { key: 'memberProfile.dash.nudgeWeeklyMet' };
    if (this.currentStreak() > 0) return { key: 'memberProfile.dash.nudgeStreak', params: { n: this.currentStreak() } };
    const toGo = Math.max(0, this.weeklyTarget() - this.weeklySessionCount());
    if (this.weeklySessionCount() > 0 && toGo > 0) return { key: 'memberProfile.dash.nudgeWeekly', params: { n: toGo } };
    return { key: 'memberProfile.dash.nudgeStart' };
  });

  // ── #4 Smart rebooking: suggest the member's usual training day ──
  rebookSuggestion = computed(() => {
    if (this.nextSession()) return null;          // already has something booked
    const mad = this.mostActiveDay();
    if (!mad) return null;
    return { dayKey: mad.nameKey };
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
    const dates = this.streakDays().sort((a, b) => b.getTime() - a.getTime());
    if (!dates.length) return 0;
    const today = new Date(this.startOfDay(new Date()));
    let checkDate = new Date(today);
    if (dates[0].getTime() < today.getTime()) checkDate.setDate(checkDate.getDate() - 1);
    let streak = 0;
    while (dates.some(d => d.getTime() === checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
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

  /** Rolling average of the daily 0/1 attendance so the sparkline reads as
   *  gentle waves instead of sharp single-day spikes. */
  sparklineSmoothed = computed(() => this.movingAverage(this.sparklineData(), 3));

  sparklinePath = computed(() => {
    const data = this.sparklineSmoothed();
    const w = 120;
    const h = 36;
    const count = data.length;
    if (count === 0) return '';
    const stepX = w / (count - 1 || 1);
    const max = Math.max(...data, 0.0001);
    const pts = data.map((v, i) => ({
      x: i * stepX,
      y: h - (v / max) * (h - 6) - 3,
    }));
    return this.smoothPath(pts);
  });

  /** Area-fill variant: the line closed down to the baseline so the gradient
   *  fills the region under the curve (not a stray auto-closed shape). */
  sparklineAreaPath = computed(() => {
    const line = this.sparklinePath();
    return line ? `${line} L120,36 L0,36 Z` : '';
  });

  sparklineDotData = computed(() => {
    const raw = this.sparklineData();
    const smoothed = this.sparklineSmoothed();
    const w = 120;
    const h = 36;
    const count = raw.length;
    if (count === 0) return [];
    const stepX = w / (count - 1 || 1);
    const max = Math.max(...smoothed, 0.0001);
    // Mark the days actually trained, but sit each dot on the smoothed curve.
    return raw.reduce<{x: number; y: number}[]>((acc, v, i) => {
      if (v > 0) {
        const x = i * stepX;
        const y = h - (smoothed[i] / max) * (h - 6) - 3;
        acc.push({ x: +x.toFixed(1), y: +y.toFixed(1) });
      }
      return acc;
    }, []);
  });

  /** Centred moving average over ±radius samples — turns spiky series into
   *  flowing waves while keeping the same number of points. */
  private movingAverage(data: number[], radius: number): number[] {
    const n = data.length;
    return data.map((_, i) => {
      let sum = 0, cnt = 0;
      for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
        sum += data[j];
        cnt++;
      }
      return cnt ? sum / cnt : 0;
    });
  }

  private smoothPath(pts: {x: number; y: number}[]): string {
    const n = pts.length;
    if (n === 0) return '';
    if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, n - 1)];
      // Clamp the control points' Y within the segment's own range so the curve
      // never overshoots above the peak or dips below the baseline — otherwise
      // sharp 0↔1 attendance spikes produce ugly waves that bulge past the data.
      const loY = Math.min(p1.y, p2.y);
      const hiY = Math.max(p1.y, p2.y);
      const clampY = (v: number) => Math.max(loY, Math.min(hiY, v));
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
      d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

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
    const today = new Date(this.startOfDay(new Date()));
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
    const today = new Date(this.startOfDay(new Date()));
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
    return Math.max(0, Math.ceil((end.getTime() - this.startOfDay(new Date())) / 86400000));
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
    return Math.floor((this.startOfDay(new Date()) - last.getTime()) / 86400000);
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
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: h - ((d.weight - min) / range) * (h - 4) - 2,
    }));
    return this.smoothPath(pts);
  });

  /** Area-fill variant of the weight trend, closed to its baseline (h = 32). */
  weightTrendAreaPath = computed(() => {
    const line = this.weightTrendPath();
    return line ? `${line} L120,32 L0,32 Z` : '';
  });

  hasProgressLogs = computed(() => this.weightLogData().length >= 2);

  /** Midnight (local) of the given date — single source of truth for day math. */
  private startOfDay(d: Date): number {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  /** Unique check-in days (local midnight), memoized once per attendance change.
   *  ~10 derived computeds read from this instead of re-deriving from raw records. */
  private attendanceDays = computed<Date[]>(() => {
    const seen = new Set<number>();
    const out: Date[] = [];
    for (const r of this.attendances()) {
      if (!r.checkInTime) continue;
      const t = this.startOfDay(new Date(r.checkInTime));
      if (!seen.has(t)) { seen.add(t); out.push(new Date(t)); }
    }
    return out;
  });

  private getDatesFromAttendance(_records?: AttendanceRecord[]): Date[] {
    // Kept for call-site compatibility; reads the memoized, de-duped day list.
    return this.attendanceDays();
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

  /** Per-field validation for the edit form (translation keys). */
  editFieldErrors = computed<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    const positive = (v: number | null) => v != null && v <= 0;
    if (!this.editFirstName().trim()) e['firstName'] = 'memberProfile.dash.valRequired';
    if (!this.editLastName().trim()) e['lastName'] = 'memberProfile.dash.valRequired';
    if (positive(this.editWeight())) e['weight'] = 'memberProfile.dash.valPositive';
    if (positive(this.editHeight())) e['height'] = 'memberProfile.dash.valPositive';
    if (positive(this.editTargetWeight())) e['targetWeight'] = 'memberProfile.dash.valPositive';
    if (positive(this.editMuscle())) e['muscle'] = 'memberProfile.dash.valPositive';
    const bf = this.editBodyFat();
    if (bf != null && (bf < 0 || bf > 100)) e['bodyFat'] = 'memberProfile.dash.valPercent';
    return e;
  });

  editValid = computed(() => Object.keys(this.editFieldErrors()).length === 0);

  /** Keep dialog focus inside the modal (Tab / Shift+Tab cycle). */
  onEditKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const modal = event.currentTarget as HTMLElement;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Progress toward the target weight as a 0–100% bar. Uses the first logged
      weight as the starting point; falls back to current weight when there are
      no logs yet (0% until the member makes progress). */
  goalProgress = computed<{ percent: number; current: number; target: number } | null>(() => {
    const current = this.profile()?.weight;
    const target = this.profile()?.targetWeight;
    if (current == null || target == null) return null;
    const data = this.weightLogData();
    const start = data.length ? data[0].weight : current;
    const total = Math.abs(start - target);
    const remaining = Math.abs(current - target);
    const percent = total <= 0
      ? (remaining < 0.5 ? 100 : 0)
      : Math.max(0, Math.min(100, Math.round((1 - remaining / total) * 100)));
    return { percent, current, target };
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
    // Move focus into the dialog once it renders (a11y: focus management).
    setTimeout(() => {
      document.querySelector<HTMLElement>('.edit-modal input, .edit-modal select')?.focus();
    });
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
    if (!p || this.savingEdit() || !this.editValid()) return;

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

  /** Confetti only for celebratory tiers (3+ day streak), so a 0/1-day
   *  "welcome back" stays calm and the milestones feel earned. */
  celebrationConfetti = computed(() => this.currentStreak() >= 3);

  /** Pop the streak-tier welcome modal once per browser session. */
  private maybeShowWelcome(): void {
    let seen = false;
    try { seen = sessionStorage.getItem('arena_dash_welcome') === '1'; } catch { seen = false; }
    if (seen) return;
    try { sessionStorage.setItem('arena_dash_welcome', '1'); } catch { /* ignore */ }
    setTimeout(() => this.showCelebration.set(true), 600);
  }

  // After the dashboard data loads (so streak/workout counts are real), run the
  // post-load popups once. A newly-earned achievement takes priority over the
  // generic welcome, so the member never sees two overlays stacked.
  private postLoadHandled = false;
  private postLoadEffect = effect(() => {
    if (this.loading()) return;
    if (this.postLoadHandled) return;
    this.postLoadHandled = true;
    if (this.checkNewAchievements()) return;
    this.maybeShowWelcome();
  });

  // ════════ Achievement unlocked modal ════════
  // Fires once when a member NEWLY earns a streak/workout milestone. The set of
  // already-earned milestones is persisted; on first ever run we seed it
  // silently so we only celebrate genuinely new unlocks going forward.
  private readonly achievedKey = 'arena_achieved_milestones';
  achievementUnlock = signal<{ icon: string; isEmoji: boolean; labelKey: string; n: number } | null>(null);
  closeAchievement(): void { this.achievementUnlock.set(null); }

  /** Every currently-unlocked milestone, ordered least → most significant. */
  private allUnlockedAchievements(): { key: string; icon: string; isEmoji: boolean; labelKey: string; n: number }[] {
    const out: { key: string; icon: string; isEmoji: boolean; labelKey: string; n: number }[] = [];
    for (const m of this.streakMilestones()) {
      if (m.unlocked) out.push({ key: `streak-${m.days}`, icon: m.icon, isEmoji: false, labelKey: m.labelKey, n: m.days });
    }
    for (const m of this.workoutMilestones()) {
      if (m.unlocked) out.push({ key: `workout-${m.count}`, icon: m.icon, isEmoji: true, labelKey: m.labelKey, n: m.count });
    }
    return out;
  }

  /** Returns true when a newly-earned milestone was found (and queued to celebrate). */
  private checkNewAchievements(): boolean {
    const unlocked = this.allUnlockedAchievements();
    let seen: string[] | null = null;
    try {
      const raw = localStorage.getItem(this.achievedKey);
      seen = raw === null ? null : (JSON.parse(raw) ?? []);
    } catch { seen = []; }

    // First ever run — seed silently, celebrate only future unlocks.
    if (seen === null) {
      try { localStorage.setItem(this.achievedKey, JSON.stringify(unlocked.map(u => u.key))); } catch { /* ignore */ }
      return false;
    }

    const seenSet = new Set(seen);
    const newly = unlocked.filter(u => !seenSet.has(u.key));
    if (!newly.length) return false;

    try { localStorage.setItem(this.achievedKey, JSON.stringify(unlocked.map(u => u.key))); } catch { /* ignore */ }
    // Celebrate the most significant newly-earned milestone.
    const best = newly[newly.length - 1];
    setTimeout(() => this.achievementUnlock.set({ icon: best.icon, isEmoji: best.isEmoji, labelKey: best.labelKey, n: best.n }), 700);
    return true;
  }

  /** Close the top-most open overlay on Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.achievementUnlock()) { this.closeAchievement(); return; }
    if (this.showCelebration()) { this.closeCelebration(); return; }
    if (this.isEditing()) { this.closeEdit(); return; }
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

  // ════════ Settings ════════
  readonly themeOptions: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
  currentTheme = computed(() => this.themeService.current);
  setTheme(theme: 'system' | 'light' | 'dark'): void { this.themeService.setTheme(theme); }

  readonly langOptions: { value: Lang; labelKey: string }[] = [
    { value: 'en', labelKey: 'memberProfile.dash.langEnglish' },
    { value: 'ar', labelKey: 'memberProfile.dash.langArabic' },
  ];
  currentLang = computed(() => this.i18n.currentLang());
  switchLang(lang: Lang): void { this.i18n.switchLang(lang); }

  loggingOut = signal(false);
  logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }

  onSectionChange(section: DashboardSection): void {
    this.activeSection.set(section);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge',
    });
  }

  /** CTA on the AI teaser → the plans page to upgrade to an AI subscription. */
  goToPlans(): void {
    this.router.navigate(['/plans']);
  }

  /** Empty-state CTA (subscribed, no plan yet) → the AI chatbot to generate one. */
  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  /** Decorative chain-link X positions for the locked card overlay. */
  protected readonly chainLinks = [-40, 0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440];

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
    return ['profile', 'qr', 'workout', 'diet', 'membership', 'progress', 'settings', 'mybookings'].includes(s);
  }

  userSubscriptions = signal<UserSubscriptionDto[]>([]);
  loadingSubscriptions = signal(false);

  loadData(): void {
    this.loading.set(true);
    this.statsLoading.set(true);
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
        this.statsLoading.set(false);
        return;
      }
      this.profile.set(data);
      // Profile is ready → render the dashboard shell immediately; the
      // secondary data below streams in without blocking the whole page.
      this.loading.set(false);

      this.loadSubscriptions(data.memberProfileId);
      this.loadBookings(data.memberProfileId || data.id || '');
      this.loadWorkoutPlan();
      this.loadNutritionPlan();
      const memberProfileId = data.memberProfileId || data.id || '';
      if (!memberProfileId) {
        this.statsLoading.set(false);
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
        this.statsLoading.set(false);
      });
    });
  }

  loadWorkoutPlan(): void {
    this.loadingWorkoutPlan.set(true);
    this.workoutSvc.getActiveWorkoutPlan().pipe(
      // The /active endpoint may return a summary without nested days — fetch the
      // full plan by id in that case so exercise weights are available.
      switchMap(plan => (plan?.days?.length ? of(plan) : (plan?.id ? this.workoutSvc.getWorkoutPlanById(plan.id) : of(plan)))),
      catchError(() => of(null as WorkoutPlanDto | null))
    ).subscribe(plan => {
      this.workoutPlan.set(plan ?? null);
      this.loadingWorkoutPlan.set(false);
    });
  }

  loadNutritionPlan(): void {
    this.nutritionSvc.getActivePlan().pipe(
      catchError(() => of(null as NutritionPlanDto | null))
    ).subscribe(plan => this.nutritionPlan.set(plan ?? null));
  }

  loadBookings(memberProfileId: string): void {
    if (!memberProfileId) return;
    this.loadingBookings.set(true);
    this.bookingService.getBookings(memberProfileId).pipe(
      catchError(() => of([] as BookingDto[]))
    ).subscribe(b => {
      this.bookings.set(b ?? []);
      this.loadingBookings.set(false);
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
