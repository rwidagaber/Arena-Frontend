import { Component, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, HostListener, inject, computed, signal, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Observable, switchMap, startWith, map, catchError, of, take, merge, fromEvent, filter, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProgressReportService, type ProgressLogDto, type ProgressSummaryDto, type CreateProgressLogDto, type AttendanceRecord } from '../../core/services/progress-report.service';
import { MemberService } from '../../core/services/member.service';
import { RevealDirective } from './reveal.directive';

type LoadState<T> =
  | { $state: 'loading' }
  | { $state: 'loaded'; value: T }
  | { $state: 'error' };

function toState<T>(source$: Observable<T>): Observable<LoadState<T>> {
  return source$.pipe(
    map(value => ({ $state: 'loaded' as const, value })),
    startWith({ $state: 'loading' as const }),
    catchError(() => of({ $state: 'error' as const }))
  );
}

type TrendDir = 'up' | 'down' | 'stable';

interface TrendResult {
  weight: TrendDir;
  bodyFat: TrendDir;
  muscleMass: TrendDir;
}

interface MotivationalMessage {
  quoteKey: string;
  author: string;
  type: 'positive' | 'warning' | 'push' | 'neutral';
}

interface GoalConfig {
  targetWeight: number;
  startWeight: number;
}

interface Achievement {
  id: string;
  icon: string;
  label: string;
  unlocked: boolean;
}

const QUOTES: Record<string, MotivationalMessage> = {
  positive_weight_loss: {
    quoteKey: 'progressReport.quotePositiveWeightLoss',
    author: 'Unknown',
    type: 'positive',
  },
  positive_muscle_gain: {
    quoteKey: 'progressReport.quotePositiveMuscleGain',
    author: 'Napoleon Hill',
    type: 'positive',
  },
  positive_fat_loss: {
    quoteKey: 'progressReport.quotePositiveFatLoss',
    author: 'Robin Sharma',
    type: 'positive',
  },
  positive_all: {
    quoteKey: 'progressReport.quotePositiveAll',
    author: 'Unknown',
    type: 'positive',
  },
  warning_weight_gain: {
    quoteKey: 'progressReport.quoteWarningWeightGain',
    author: 'Unknown',
    type: 'warning',
  },
  warning_fat_gain: {
    quoteKey: 'progressReport.quoteWarningFatGain',
    author: 'Unknown',
    type: 'warning',
  },
  warning_muscle_loss: {
    quoteKey: 'progressReport.quoteWarningMuscleLoss',
    author: 'Unknown',
    type: 'warning',
  },
  push_neutral: {
    quoteKey: 'progressReport.quotePushNeutral',
    author: 'Unknown',
    type: 'push',
  },
  push_stable: {
    quoteKey: 'progressReport.quotePushStable',
    author: 'Unknown',
    type: 'push',
  },
  first_entry: {
    quoteKey: 'progressReport.quoteFirstEntry',
    author: 'Unknown',
    type: 'positive',
  },
};

interface AchievementCheck {
  id: string; icon: string; label: string;
  /** For count-based achievements: the goal value, plus the current value getter (drives challenge progress bars). */
  target?: number;
  value?: (logs: number, streak: number | null, summary: ProgressSummaryDto | null) => number;
  check: (logs: number, streak: number | null, summary: ProgressSummaryDto | null) => boolean;
}

const ACHIEVEMENT_DEFS: AchievementCheck[] = [
  { id: 'first_log', icon: 'fa-solid fa-bullseye', label: 'progressReport.achFirstLog', target: 1, value: (l) => l, check: (l) => l >= 1 },
  { id: 'streak_3', icon: 'fa-solid fa-fire', label: 'progressReport.achStreak3', target: 3, value: (_, s) => s ?? 0, check: (_, s) => s != null && s >= 3 },
  { id: 'streak_7', icon: 'fa-solid fa-star', label: 'progressReport.achStreak7', target: 7, value: (_, s) => s ?? 0, check: (_, s) => s != null && s >= 7 },
  { id: 'logs_5', icon: 'fa-solid fa-chart-column', label: 'progressReport.achLogs5', target: 5, value: (l) => l, check: (l) => l >= 5 },
  { id: 'logs_10', icon: 'fa-solid fa-medal', label: 'progressReport.achLogs10', target: 10, value: (l) => l, check: (l) => l >= 10 },
  { id: 'fat_loss', icon: 'fa-solid fa-droplet', label: 'progressReport.achFatLoss', check: (l, _, s) => l >= 2 && s != null && (s.bodyFatChange ?? 0) < 0 },
  { id: 'muscle_gain', icon: 'fa-solid fa-dumbbell', label: 'progressReport.achMuscleGain', check: (l, _, s) => l >= 2 && s != null && (s.muscleMassChange ?? 0) > 0 },
  { id: 'weight_down', icon: 'fa-solid fa-arrow-trend-down', label: 'progressReport.achWeightDown', check: (l, _, s) => l >= 2 && s != null && (s.weightChange ?? 0) < 0 },
];

/** Number of rotating timeline motivation lines (keys progressReport.motivation0..N-1) */
const MOTIVATION_COUNT = 14;

@Component({
  selector: 'app-progress-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, RevealDirective],
  templateUrl: './progress-report.component.html',
  styleUrl: './progress-report.component.scss',
})
export class ProgressReportComponent {
  private service = inject(ProgressReportService);
  private member = inject(MemberService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private translate = inject(TranslateService);

  /** Shared member-profile stream (DB) — source for member id and target weight. */
  private profile$ = this.member.getProfile().pipe(
    catchError(() => of(null)),
    shareReplay(1)
  );

  protected Math = Math;

  constructor() {
    // Target weight is sourced from the member profile (DB); no local storage.
    this.profile$.subscribe(p => {
      if (p?.targetWeight != null && p.targetWeight > 0) {
        this.profileTargetWeight.set(p.targetWeight);
      }
    });
  }

  private refresh$ = new Subject<void>();

  private visibilityRefresh$ = fromEvent(document, 'visibilitychange').pipe(
    filter(() => document.visibilityState === 'visible')
  );

  progressSummaryState$ = merge(this.refresh$, this.visibilityRefresh$).pipe(
    startWith(undefined),
    switchMap(() =>
      this.service.getProgress().pipe(
        map(value => ({ $state: 'loaded' as const, value })),
        startWith({ $state: 'loading' as const }),
        catchError(() => of({ $state: 'error' as const }))
      )
    )
  );

  attendancesState$ = merge(this.refresh$, this.visibilityRefresh$).pipe(
    startWith(undefined),
    switchMap(() => this.profile$.pipe(
      switchMap(p => {
        const id = p?.memberProfileId || p?.id || '';
        return id
          ? toState(this.service.getAttendances(id))
          : of({ $state: 'loaded' as const, value: [] as AttendanceRecord[] });
      })
    ))
  );

  private summarySignal = toSignal(this.progressSummaryState$, { requireSync: true });

  private get summary(): ProgressSummaryDto | null {
    const s = this.summarySignal();
    if (s.$state !== 'loaded') return null;
    return s.value;
  }

  private get logs(): ProgressLogDto[] {
    return this.summary?.logs ?? [];
  }

  protected currentWeight = computed(() => this.summary?.currentWeight ?? null);
  protected currentBodyFat = computed(() => this.summary?.currentBodyFat ?? null);
  protected currentMuscleMass = computed(() => this.summary?.currentMuscleMass ?? null);
  protected weightChange = computed(() => this.summary?.weightChange ?? null);
  protected bodyFatChange = computed(() => this.summary?.bodyFatChange ?? null);
  protected muscleMassChange = computed(() => this.summary?.muscleMassChange ?? null);
  protected totalLogs = computed(() => this.logs.length);
  protected hasMultipleLogs = computed(() => this.logs.length >= 2);

  protected daysSinceFirstLog = computed(() => {
    const entries = this.logs;
    if (entries.length === 0) return null;
    const first = new Date(entries[entries.length - 1].loggedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  });

  /** Returns 0-100 where current value sits in the min-max range of all logs (inverted for weight/fat where lower is better) */
  protected weightProgress = computed(() => {
    const cur = this.summary?.currentWeight;
    if (cur == null || this.logs.length < 2) return null;
    const vals = this.logs.map(e => e.weight);
    return this.invertProgress(cur, vals);
  });

  protected bodyFatProgress = computed(() => {
    const cur = this.summary?.currentBodyFat;
    if (cur == null || this.logs.length < 2) return null;
    const vals = this.logs.map(e => e.bodyFat).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    return this.invertProgress(cur, vals);
  });

  protected muscleMassProgress = computed(() => {
    const cur = this.summary?.currentMuscleMass;
    if (cur == null || this.logs.length < 2) return null;
    const vals = this.logs.map(e => e.muscleMass).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    return this.directProgress(cur, vals);
  });

  private invertProgress(cur: number, vals: number[]): number {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return +((1 - (cur - min) / range) * 100).toFixed(0);
  }

  private directProgress(cur: number, vals: number[]): number {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return +(((cur - min) / range) * 100).toFixed(0);
  }

  protected trend = computed<TrendResult | null>(() => {
    const entries = this.logs;
    if (entries.length < 2) return null;
    return this.calcTrend(entries);
  });

  protected message = computed<MotivationalMessage>(() => {
    const s = this.summarySignal();
    if (s.$state !== 'loaded') return { quoteKey: 'progressReport.quoteLoading', author: '', type: 'neutral' };
    const entries = s.value.logs;
    if (entries.length <= 1) return QUOTES['first_entry'];
    const trend = this.trend();
    if (!trend) return QUOTES['push_neutral'];
    if (trend.weight === 'up' && trend.bodyFat !== 'down' && trend.muscleMass !== 'up') return QUOTES['warning_weight_gain'];
    if (trend.bodyFat === 'up' && trend.weight !== 'down') return QUOTES['warning_fat_gain'];
    if (trend.muscleMass === 'down') return QUOTES['warning_muscle_loss'];
    if (trend.weight === 'down' && trend.bodyFat === 'down') return QUOTES['positive_weight_loss'];
    if (trend.muscleMass === 'up') return QUOTES['positive_muscle_gain'];
    return QUOTES['push_stable'];
  });

  protected latestEntry = computed<ProgressLogDto | null>(() => {
    const entries = this.logs;
    return entries.length > 0 ? entries[0] : null;
  });

  protected sparklinePoints = computed(() => {
    const entries = this.logs;
    if (entries.length < 2) return '';
    const weights = entries.map(e => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const w = 200;
    const h = 60;
    const pad = 4;
    return weights
      .map((wgt, i) => {
        const x = (i / (weights.length - 1)) * w;
        const y = h - pad - ((wgt - min) / range) * (h - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  protected sparklineArea = computed(() => {
    const pts = this.sparklinePoints();
    if (!pts) return '';
    const first = pts.split(' ')[0];
    const last = pts.split(' ').pop();
    return `${pts} ${last} 200,60 0,60 ${first}`;
  });

  protected sparklineCoords = computed(() => {
    const entries = this.logs;
    if (entries.length < 2) return [];
    const weights = entries.map(e => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const w = 200;
    const h = 60;
    const pad = 4;
    return weights.map((wgt, i) => ({
      x: +(i / (weights.length - 1) * w).toFixed(1),
      y: +(h - pad - ((wgt - min) / range) * (h - 2 * pad)).toFixed(1),
    }));
  });

  /** Chronological (oldest → newest) values for one metric, nulls dropped. */
  private seriesValues(key: 'weight' | 'bodyFat' | 'muscleMass'): number[] {
    const chrono = [...this.logs].reverse();
    return chrono
      .map(e => (key === 'weight' ? e.weight : key === 'bodyFat' ? e.bodyFat : e.muscleMass))
      .filter((v): v is number => v != null);
  }

  /** Builds a tiny sparkline (line + filled area) sized to a 100×28 viewBox. */
  private buildSpark(values: number[], w = 100, h = 28, pad = 3): { line: string; area: string } | null {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = pts.join(' ');
    const firstX = pts[0].split(',')[0];
    const lastX = pts[pts.length - 1].split(',')[0];
    return { line, area: `${firstX},${h} ${line} ${lastX},${h}` };
  }

  protected weightSpark = computed(() => this.buildSpark(this.seriesValues('weight')));
  protected bodyFatSpark = computed(() => this.buildSpark(this.seriesValues('bodyFat')));
  protected muscleSpark = computed(() => this.buildSpark(this.seriesValues('muscleMass')));

  /** Timeline progressive disclosure: collapsed shows the latest few entries. */
  protected timelineExpanded = signal(false);
  protected readonly timelineCollapsedCount = 3;
  protected visibleLogs = computed(() => {
    const logs = this.logs;
    return this.timelineExpanded() ? logs : logs.slice(0, this.timelineCollapsedCount);
  });
  toggleTimeline(): void {
    this.timelineExpanded.update(v => !v);
  }

  protected showForm = signal(false);
  protected saving = signal(false);
  protected formError = signal('');
  protected formWeight = signal<number | null>(null);
  protected formBodyFat = signal<number | null>(null);
  protected formMuscleMass = signal<number | null>(null);

  /** Edit/delete state. Each entry may be edited only once (tracked client-side). */
  protected editingId = signal<string | null>(null);
  protected editedIds = signal<Set<string>>(new Set<string>());
  protected confirmDeleteId = signal<string | null>(null);
  protected deleting = signal(false);

  protected isEdited(id: string): boolean { return this.editedIds().has(id); }
  protected isEditable(id: string): boolean { return !this.editedIds().has(id); }

  protected showGoalForm = signal(false);
  protected goalFormWeight = signal<number | null>(null);
  protected goalFormStart = signal<number | null>(null);

  /** Target weight from the member profile (DB). */
  private profileTargetWeight = signal<number | null>(null);

  /** Start weight derived from the earliest progress log (DB). */
  private goalStartWeight = computed(() => {
    const chrono = [...this.logs].reverse();
    return chrono[0]?.weight ?? this.currentWeight() ?? null;
  });

  /** Goal config sourced entirely from the DB: target = profile, start = first log. */
  protected goalConfig = computed<GoalConfig | null>(() => {
    const target = this.profileTargetWeight();
    if (target == null || target <= 0) return null;
    const start = this.goalStartWeight();
    if (start == null) return null;
    return { targetWeight: target, startWeight: start };
  });

  /** Week-over-week data (last 7 days vs previous 7 days) */
  protected weeklyComparison = computed(() => {
    const entries = this.logs;
    if (entries.length < 4) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;
    const recent = entries.filter(e => new Date(e.loggedAt).getTime() > weekAgo);
    const prev = entries.filter(e => {
      const t = new Date(e.loggedAt).getTime();
      return t > twoWeeksAgo && t <= weekAgo;
    });
    if (recent.length === 0 || prev.length === 0) return null;
    const avgRecent = recent.reduce((s, e) => s + e.weight, 0) / recent.length;
    const avgPrev = prev.reduce((s, e) => s + e.weight, 0) / prev.length;
    return { avgRecent, avgPrev, change: avgRecent - avgPrev };
  });

  /** Progress ring towards goal (0–100) */
  protected goalProgress = computed(() => {
    const goal = this.goalConfig();
    const cur = this.currentWeight();
    if (!goal || cur == null) return null;
    const total = goal.startWeight - goal.targetWeight;
    if (Math.abs(total) < 0.5) return 0;
    const done = goal.startWeight - cur;
    const pct = Math.round((done / total) * 100);
    return Math.max(0, Math.min(100, pct));
  });

  /** Estimated time to reach the goal based on the average daily rate of change. */
  protected goalEta = computed<{ state: 'reached' | 'off' | 'eta'; days: number } | null>(() => {
    const goal = this.goalConfig();
    const cur = this.currentWeight();
    const logs = this.logs;
    if (!goal || cur == null || logs.length < 2) return null;
    const chrono = [...logs].reverse();
    const first = chrono[0];
    const last = chrono[chrono.length - 1];
    const days = (new Date(last.loggedAt).getTime() - new Date(first.loggedAt).getTime()) / 86400000;
    if (days < 1) return null;
    const ratePerDay = (last.weight - first.weight) / days;
    const remaining = goal.targetWeight - cur;
    if (Math.abs(remaining) < 0.1) return { state: 'reached', days: 0 };
    if (ratePerDay === 0 || Math.sign(ratePerDay) !== Math.sign(remaining)) return { state: 'off', days: 0 };
    const d = Math.ceil(remaining / ratePerDay);
    if (d <= 0 || d > 3650) return null;
    return { state: 'eta', days: d };
  });

  /** Personal records ("PRs") derived from the existing log history. */
  protected personalRecords = computed<{ key: string; icon: string; value: string; unit?: string; tone?: 'up' | 'down' }[]>(() => {
    const logs = this.logs;
    if (logs.length === 0) return [];
    const weights = logs.map(l => l.weight);
    const muscles = logs.map(l => l.muscleMass).filter((v): v is number => v != null);
    const fats = logs.map(l => l.bodyFat).filter((v): v is number => v != null);
    const chrono = [...logs].reverse();
    const totalChange = +(chrono[chrono.length - 1].weight - chrono[0].weight).toFixed(1);
    const days = this.daysSinceFirstLog();
    const recs: { key: string; icon: string; value: string; unit?: string; tone?: 'up' | 'down' }[] = [
      { key: 'progressReport.recEntries', icon: 'fa-clipboard-list', value: String(logs.length) },
    ];
    if (days != null) recs.push({ key: 'progressReport.recDays', icon: 'fa-calendar-days', value: String(days), unit: 'progressReport.unitDays' });
    recs.push({ key: 'progressReport.recLowestWeight', icon: 'fa-weight-scale', value: Math.min(...weights).toFixed(1), unit: 'progressReport.unitKg' });
    if (logs.length >= 2) {
      recs.push({ key: 'progressReport.recTotalChange', icon: 'fa-arrows-down-to-line', value: (totalChange > 0 ? '+' : '') + totalChange, unit: 'progressReport.unitKg', tone: totalChange <= 0 ? 'down' : 'up' });
    }
    if (muscles.length) recs.push({ key: 'progressReport.recPeakMuscle', icon: 'fa-dumbbell', value: Math.max(...muscles).toFixed(1), unit: 'progressReport.unitKg' });
    if (fats.length) recs.push({ key: 'progressReport.recLowestFat', icon: 'fa-fire-flame-curved', value: Math.min(...fats).toFixed(1), unit: 'progressReport.unitPercent' });
    return recs;
  });

  /** Downloads the full log history as a CSV file. */
  exportPdf(): void {
    const logs = this.logs;
    if (!logs.length) return;

    const goal = this.goalConfig();
    const prog = this.goalProgress();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const rows = [...logs].reverse().map((e, i) => `
        <tr>
          <td class="idx">${i + 1}</td>
          <td>${fmt(e.loggedAt)}</td>
          <td><strong>${e.weight}</strong> kg</td>
          <td>${e.bodyFat != null ? e.bodyFat + ' %' : '—'}</td>
          <td>${e.muscleMass != null ? e.muscleMass + ' kg' : '—'}</td>
        </tr>`).join('');

    const stat = (label: string, val: string) =>
      `<div class="stat"><span class="stat-val">${val}</span><span class="stat-lbl">${label}</span></div>`;

    const summary = `
      <section class="stats">
        ${stat('Current Weight', (this.currentWeight() ?? '—') + ' kg')}
        ${stat('Body Fat', this.currentBodyFat() != null ? this.currentBodyFat() + ' %' : '—')}
        ${stat('Muscle Mass', this.currentMuscleMass() != null ? this.currentMuscleMass() + ' kg' : '—')}
        ${stat('Entries', String(logs.length))}
      </section>`;

    const goalBlock = goal ? `
      <h2>Weight Goal</h2>
      <section class="goal">
        <div class="goal-grid">
          <div><span>Start</span><strong>${goal.startWeight} kg</strong></div>
          <div><span>Current</span><strong>${this.currentWeight() ?? '—'} kg</strong></div>
          <div><span>Target</span><strong class="lime">${goal.targetWeight} kg</strong></div>
          ${prog != null ? `<div><span>Progress</span><strong class="lime">${prog}%</strong></div>` : ''}
        </div>
        ${prog != null ? `<div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, prog))}%"></div></div>` : ''}
      </section>` : '';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>arena-progress-${new Date().toISOString().slice(0, 10)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;background:#eceae4;color:#181818;padding:32px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:820px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.12)}
  header{background:linear-gradient(135deg,#181818,#10131B);color:#fff;padding:30px 36px;position:relative;overflow:hidden}
  header::after{content:'';position:absolute;top:0;right:0;bottom:0;width:6px;background:#C6EF2E}
  .brand{display:flex;align-items:center;gap:12px}
  .logo{width:38px;height:38px;border-radius:10px;background:#C6EF2E;color:#10131B;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px}
  .brand h1{font-size:22px;font-weight:800;letter-spacing:-.02em}
  .brand span{color:#C6EF2E}
  .sub{margin-top:14px;font-size:13px;color:rgba(255,255,255,.6)}
  .sub strong{color:#fff}
  .body{padding:26px 36px 34px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6b6b;margin:24px 0 12px;font-weight:700}
  .body h2:first-child{margin-top:0}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .stat{background:#f6f6f4;border:1px solid rgba(0,0,0,.05);border-radius:14px;padding:16px;text-align:center}
  .stat-val{display:block;font-size:23px;font-weight:800;letter-spacing:-.02em;color:#181818}
  .stat-lbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#8a8a8a;margin-top:4px;font-weight:600}
  .goal{background:linear-gradient(135deg,rgba(198,239,46,.14),rgba(198,239,46,.04));border:1px solid rgba(198,239,46,.3);border-radius:16px;padding:18px 20px}
  .goal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .goal-grid div{display:flex;flex-direction:column;gap:2px}
  .goal-grid span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8a8a8a;font-weight:600}
  .goal-grid strong{font-size:17px;font-weight:800}
  .lime{color:#4d7c0f}
  .bar{height:7px;border-radius:7px;background:rgba(0,0,0,.06);margin-top:16px;overflow:hidden}
  .bar-fill{height:100%;border-radius:7px;background:linear-gradient(90deg,#aed81f,#C6EF2E)}
  table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px}
  thead th{text-align:left;padding:10px 12px;background:#10131B;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
  tbody td{padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.05)}
  tbody tr:nth-child(even){background:#faf9f6}
  td.idx{color:#b0b0b0;font-weight:700;width:36px}
  footer{padding:18px 36px;border-top:1px solid rgba(0,0,0,.06);color:#9a9a9a;font-size:11px;text-align:center}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}}
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand"><div class="logo">A</div><h1>ARENA <span>· Progress Report</span></h1></div>
      <div class="sub">Generated on <strong>${today}</strong> · ${logs.length} measurement${logs.length === 1 ? '' : 's'}</div>
    </header>
    <div class="body">
      <h2>Summary</h2>
      ${summary}
      ${goalBlock}
      <h2>Measurement Timeline</h2>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Weight</th><th>Body Fat</th><th>Muscle Mass</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <footer>Arena Fitness · Keep showing up — your progress is your power.</footer>
  </div>
</body>
</html>`;

    // Render the print-styled report into a hidden iframe and open the
    // browser's print dialog — choose "Save as PDF" to download a PDF.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow!;
    const cleanup = () => iframe.remove();

    const triggerPrint = () => {
      win.focus();
      // Remove the iframe once the print dialog is dismissed.
      win.onafterprint = () => setTimeout(cleanup, 0);
      win.print();
      // Fallback cleanup in case onafterprint never fires.
      setTimeout(cleanup, 60000);
    };

    // Give the document (and fonts) a moment to lay out before printing.
    if (doc.readyState === 'complete') {
      setTimeout(triggerPrint, 250);
    } else {
      win.onload = () => setTimeout(triggerPrint, 250);
    }
  }

  /** Achievement badges computed from log data */
  protected achievements = computed(() => {
    const logs = this.logs;
    const streak = this.daysSinceFirstLog();
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: def.check(logs.length, streak, this.summary),
    }));
  });

  protected unlockedAchievements = computed(() => this.achievements().filter(a => a.unlocked));
  protected lockedAchievements = computed(() => this.achievements().filter(a => !a.unlocked));

  // ── Arena Momentum: synthesized score, level/XP, and live challenges ──

  /** 0–100 momentum score from recent trajectory, streak and consistency. */
  protected momentumScore = computed<number | null>(() => {
    const s = this.summary;
    if (!s || this.logs.length === 0) return null;
    let score = 50;
    const t = this.trend();
    const goal = this.goalConfig();
    const wantLighter = goal ? goal.startWeight > goal.targetWeight : true;
    if (t) {
      if (t.weight === (wantLighter ? 'down' : 'up')) score += 12;
      else if (t.weight === (wantLighter ? 'up' : 'down')) score -= 8;
      if (t.bodyFat === 'down') score += 10; else if (t.bodyFat === 'up') score -= 6;
      if (t.muscleMass === 'up') score += 10; else if (t.muscleMass === 'down') score -= 6;
    }
    score += Math.min(15, this.daysSinceFirstLog() ?? 0);
    score += Math.min(13, this.logs.length * 2);
    return Math.max(5, Math.min(100, Math.round(score)));
  });

  protected momentumTier = computed(() => {
    const sc = this.momentumScore();
    if (sc == null) return null;
    if (sc >= 80) return { key: 'progressReport.tierUnstoppable', cls: 'tier-unstoppable' };
    if (sc >= 60) return { key: 'progressReport.tierOnFire', cls: 'tier-onfire' };
    if (sc >= 40) return { key: 'progressReport.tierBuilding', cls: 'tier-building' };
    return { key: 'progressReport.tierIgniting', cls: 'tier-igniting' };
  });

  protected momentumTrend = computed<TrendDir>(() => {
    const l = this.logs;
    if (l.length < 2) return 'stable';
    return this.isImproving(l[0], l[1]) ? 'up' : 'down';
  });

  protected readonly momentumCirc = 2 * Math.PI * 80;
  protected momentumOffset = computed(() => this.momentumCirc * (1 - (this.momentumScore() ?? 0) / 100));

  /** Tap-to-reveal breakdown of how the momentum score is composed. */
  protected momentumOpen = signal(false);
  toggleMomentum(): void {
    this.momentumOpen.update(v => !v);
  }
  protected momentumBreakdown = computed<{ key: string; points: number; params?: Record<string, unknown> }[]>(() => {
    const s = this.summary;
    if (!s || this.logs.length === 0) return [];
    const t = this.trend();
    const goal = this.goalConfig();
    const wantLighter = goal ? goal.startWeight > goal.targetWeight : true;
    const rows: { key: string; points: number; params?: Record<string, unknown> }[] = [
      { key: 'progressReport.bdBase', points: 50 },
    ];
    if (t) {
      rows.push({ key: 'progressReport.bdWeight', points: t.weight === (wantLighter ? 'down' : 'up') ? 12 : t.weight === (wantLighter ? 'up' : 'down') ? -8 : 0 });
      rows.push({ key: 'progressReport.bdBodyFat', points: t.bodyFat === 'down' ? 10 : t.bodyFat === 'up' ? -6 : 0 });
      rows.push({ key: 'progressReport.bdMuscle', points: t.muscleMass === 'up' ? 10 : t.muscleMass === 'down' ? -6 : 0 });
    }
    const days = this.daysSinceFirstLog() ?? 0;
    rows.push({ key: 'progressReport.bdStreak', points: Math.min(15, days), params: { n: days } });
    rows.push({ key: 'progressReport.bdConsistency', points: Math.min(13, this.logs.length * 2), params: { n: this.logs.length } });
    return rows;
  });

  /** XP from logs, streak days and unlocked badges → drives the level. */
  protected xp = computed(() =>
    this.logs.length * 100 + (this.daysSinceFirstLog() ?? 0) * 20 + this.unlockedAchievements().length * 50
  );
  private readonly XP_PER_LEVEL = 400;
  protected level = computed(() => Math.floor(this.xp() / this.XP_PER_LEVEL) + 1);
  protected xpIntoLevel = computed(() => this.xp() % this.XP_PER_LEVEL);
  protected xpForLevel = computed(() => this.XP_PER_LEVEL);
  protected xpPct = computed(() => Math.round((this.xpIntoLevel() / this.XP_PER_LEVEL) * 100));
  protected levelTitle = computed(() => {
    const lv = this.level();
    if (lv >= 11) return 'progressReport.levelLegend';
    if (lv >= 9) return 'progressReport.levelChampion';
    if (lv >= 7) return 'progressReport.levelWarrior';
    if (lv >= 5) return 'progressReport.levelContender';
    if (lv >= 3) return 'progressReport.levelChallenger';
    return 'progressReport.levelRookie';
  });

  /** Locked count-based achievements, surfaced as live challenges with progress. */
  protected activeChallenges = computed(() => {
    const logsN = this.logs.length;
    const streak = this.daysSinceFirstLog();
    const summary = this.summary;
    return ACHIEVEMENT_DEFS
      .filter(d => d.target != null && d.value && !d.check(logsN, streak, summary))
      .map(d => {
        const cur = Math.min(d.value!(logsN, streak, summary), d.target!);
        return {
          id: d.id,
          icon: d.icon,
          label: d.label,
          current: cur,
          target: d.target!,
          pct: Math.round((cur / d.target!) * 100),
          remaining: Math.max(0, d.target! - cur),
        };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  });

  /** Closes whichever modal is open when Escape is pressed. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showForm()) this.closeForm();
    else if (this.showGoalForm()) this.closeGoalForm();
  }

  private lockScroll(lock: boolean): void {
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  openForm(): void {
    this.editingId.set(null);
    this.formWeight.set(null);
    this.formBodyFat.set(null);
    this.formMuscleMass.set(null);
    this.formError.set('');
    this.lockScroll(true);
    this.zone.run(() => {
      this.showForm.set(true);
      this.cdr.markForCheck();
    });
  }

  /** Opens the modal pre-filled to edit an existing entry (only if it hasn't been edited yet). */
  openEditForm(entry: ProgressLogDto): void {
    if (!this.isEditable(entry.id)) return;
    this.editingId.set(entry.id);
    this.formWeight.set(entry.weight);
    this.formBodyFat.set(entry.bodyFat);
    this.formMuscleMass.set(entry.muscleMass);
    this.formError.set('');
    this.lockScroll(true);
    this.zone.run(() => {
      this.showForm.set(true);
      this.cdr.markForCheck();
    });
  }

  closeForm(): void {
    this.lockScroll(false);
    this.zone.run(() => {
      this.showForm.set(false);
      this.editingId.set(null);
      this.cdr.markForCheck();
    });
  }

  requestDelete(id: string): void { this.confirmDeleteId.set(id); }
  cancelDelete(): void { this.confirmDeleteId.set(null); }
  confirmDelete(id: string): void {
    this.deleting.set(true);
    this.service.deleteProgressEntry(id).pipe(take(1)).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDeleteId.set(null);
        if (this.editedIds().has(id)) {
          const next = new Set(this.editedIds());
          next.delete(id);
          this.editedIds.set(next);
        }
        this.refresh$.next();
      },
      error: () => { this.deleting.set(false); },
    });
  }

  onWeightInput(value: string): void {
    if (value == null || value.trim() === '') { this.formWeight.set(null); return; }
    const num = parseFloat(value.replace(/,/g, '.'));
    this.formWeight.set(isNaN(num) ? null : num);
  }

  onBodyFatInput(value: string): void {
    if (value == null || value.trim() === '') { this.formBodyFat.set(null); return; }
    const num = parseFloat(value.replace(/,/g, '.'));
    this.formBodyFat.set(isNaN(num) ? null : num);
  }

  onMuscleMassInput(value: string): void {
    if (value == null || value.trim() === '') { this.formMuscleMass.set(null); return; }
    const num = parseFloat(value.replace(/,/g, '.'));
    this.formMuscleMass.set(isNaN(num) ? null : num);
  }

  /** Increment/decrement a numeric field via the custom stepper, keeping the input and signal in sync. */
  applyStep(input: HTMLInputElement, delta: number, min: number, max: number, sig: WritableSignal<number | null>): void {
    const parsed = parseFloat((input.value || '').replace(/,/g, '.'));
    const base = isNaN(parsed) ? 0 : parsed;
    const next = Math.min(max, Math.max(min, Math.round((base + delta) * 10) / 10));
    input.value = String(next);
    sig.set(next);
  }

  submitEntry(): void {
    const weight = this.formWeight();
    if (!weight || weight <= 0) {
      this.formError.set(this.translate.instant('progressReport.errValidWeight'));
      return;
    }
    this.saving.set(true);
    this.formError.set('');

    const dto: CreateProgressLogDto = {
      weight,
      bodyFat: this.formBodyFat(),
      muscleMass: this.formMuscleMass(),
    };

    const editId = this.editingId();
    // The backend has no update endpoint, so an edit = delete the old entry then create a new one.
    const request$ = editId
      ? this.service.deleteProgressEntry(editId).pipe(switchMap(() => this.service.createProgressEntry(dto)))
      : this.service.createProgressEntry(dto);

    request$.pipe(take(1)).subscribe({
      next: (created: ProgressLogDto) => {
        this.saving.set(false);
        if (editId) {
          const next = new Set(this.editedIds());
          next.delete(editId);
          if (created?.id) next.add(created.id);
          this.editedIds.set(next);
        }
        this.lockScroll(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.refresh$.next();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const msg = err instanceof Error ? err.message : this.translate.instant('progressReport.errSaveFailed');
        this.formError.set(msg);
      },
    });
  }

  openGoalForm(): void {
    const cur = this.currentWeight();
    this.goalFormWeight.set(null);
    this.goalFormStart.set(cur);
    this.formError.set('');
    this.lockScroll(true);
    this.zone.run(() => {
      this.showGoalForm.set(true);
      this.cdr.markForCheck();
    });
  }

  closeGoalForm(): void {
    this.lockScroll(false);
    this.zone.run(() => {
      this.showGoalForm.set(false);
      this.cdr.markForCheck();
    });
  }

  onGoalWeightInput(value: string): void {
    if (value === '' || value == null) { this.goalFormWeight.set(null); return; }
    const num = parseFloat(value);
    this.goalFormWeight.set(isNaN(num) ? null : num);
  }

  onGoalStartInput(value: string): void {
    if (value === '' || value == null) { this.goalFormStart.set(null); return; }
    const num = parseFloat(value);
    this.goalFormStart.set(isNaN(num) ? null : num);
  }

  saveGoal(): void {
    const target = this.goalFormWeight();
    if (!target || target <= 0) {
      this.formError.set(this.translate.instant('progressReport.errValidValues'));
      return;
    }
    // Target weight is persisted to the DB; the ring's start weight is derived
    // from the earliest progress log, so the goal survives reloads with no local storage.
    this.profileTargetWeight.set(target);
    this.member.updateProfile({ targetWeight: target }).subscribe({ next: () => {}, error: () => {} });
    this.lockScroll(false);
    this.showGoalForm.set(false);
  }

  clearGoal(): void {
    this.profileTargetWeight.set(null);
    this.member.updateProfile({ targetWeight: 0 }).subscribe({ next: () => {}, error: () => {} });
  }

  private calcTrend(entries: ProgressLogDto[]): TrendResult {
    const first = entries[entries.length - 1];
    const last = entries[0];
    return {
      weight: this.direction(last.weight - first.weight),
      bodyFat: last.bodyFat != null && first.bodyFat != null ? this.direction(last.bodyFat - first.bodyFat) : 'stable',
      muscleMass: last.muscleMass != null && first.muscleMass != null ? this.direction(last.muscleMass - first.muscleMass) : 'stable',
    };
  }

  private direction(diff: number): TrendDir {
    if (diff > 0.5) return 'up';
    if (diff < -0.5) return 'down';
    return 'stable';
  }

  protected trendIcon(dir: TrendDir): string {
    if (dir === 'up') return '↑';
    if (dir === 'down') return '↓';
    return '→';
  }

  protected formatDiff(val: number): string {
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(1)}`;
  }

  protected isImproving(current: ProgressLogDto, previous: ProgressLogDto): boolean {
    if (!previous) return true;
    const weightDown = current.weight <= previous.weight;
    const fatDown = current.bodyFat != null && previous.bodyFat != null && current.bodyFat <= previous.bodyFat;
    const muscleUp = current.muscleMass != null && previous.muscleMass != null && current.muscleMass >= previous.muscleMass;
    const checks = [weightDown];
    if (current.bodyFat != null && previous.bodyFat != null) checks.push(fatDown);
    if (current.muscleMass != null && previous.muscleMass != null) checks.push(muscleUp);
    return checks.filter(Boolean).length >= Math.ceil(checks.length / 2);
  }

  /** Returns the translate key for a rotating motivational line, keyed by entry index. */
  protected tlMotivation(index: number): string {
    return `progressReport.motivation${index % MOTIVATION_COUNT}`;
  }
}
