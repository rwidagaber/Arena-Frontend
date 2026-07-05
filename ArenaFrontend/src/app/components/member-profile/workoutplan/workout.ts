import {
  Component, OnInit, inject, signal, computed, effect,
  ChangeDetectionStrategy, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout';
import type { WorkoutPlanDto, WorkoutDayDto, WorkoutExerciseDto } from '../../../core/models/workout';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../../core/services/themeservice';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-workout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workout.html',
  styleUrl: './workout.css',
})
export class WorkoutComponent implements OnInit {

  readonly t         = inject(TranslateService);
  private workoutSvc = inject(WorkoutService);
  private themeSvc   = inject(ThemeService);
  private sanitizer  = inject(DomSanitizer);

  memberProfileId = input<string>('');

  isDarkMode = computed(() => this.themeSvc.isDark);

  // ── View state ────────────────────────────────────────────────────────────────
  view             = signal<'plans' | 'plan-detail' | 'exercise-detail'>('plans');
  plans            = signal<WorkoutPlanDto[]>([]);
  selectedPlan     = signal<WorkoutPlanDto | null>(null);
  selectedDayId    = signal<string | null>(null);
  selectedExercise = signal<WorkoutExerciseDto | null>(null);
  loading          = signal(true);
  error            = signal<string | null>(null);

  // ── Animated counter ──────────────────────────────────────────────────────────
  animatedCount = signal<number>(0);

  startCounter(target: number) {
    this.animatedCount.set(0);
    if (target === 0) return;

    const duration = 1500;
    const steps = 50;
    const stepTime = duration / steps;
    const increment = target / steps;

    let currentCount = 0;

    const timer = setInterval(() => {
      currentCount += increment;

      if (currentCount >= target) {
        this.animatedCount.set(target);
        clearInterval(timer);
      } else {
        this.animatedCount.set(Math.ceil(currentCount));
      }
    }, stepTime);
  }

  // ── Filters ───────────────────────────────────────────────────────────────────
  searchQuery    = signal('');
  showActiveOnly = signal(false);

  /** آخر plan في الـ array = أحدث plan اتضاف — لازم يكون قبل filteredPlans */
  latestPlanId = computed(() => {
    const plans = this.plans();
    return plans.length ? plans[plans.length - 1].id : null;
  });

 filteredPlans = computed<WorkoutPlanDto[]>(() => {
  const q        = this.searchQuery().toLowerCase().trim();
  const active   = this.showActiveOnly();
  const latestId = this.latestPlanId();

  return [...this.plans()].reverse().filter(p => {
    const matchSearch = !q || p.name.toLowerCase().includes(q);
    const matchActive = !active || p.id === latestId;
    return matchSearch && matchActive;
  });
});

  // ── Pagination ────────────────────────────────────────────────────────────────
  currentPage = signal(0);
  pageSize = 8;

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredPlans().length / this.pageSize)));

  paginatedPlans = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredPlans().slice(start, start + this.pageSize);
  });

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  pageArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  private resetPageOnFilter = effect(() => {
    this.searchQuery();
    this.showActiveOnly();
    this.currentPage.set(0);
  });

  selectedDay = computed<WorkoutDayDto | null>(() => {
    const plan = this.selectedPlan();
    const id   = this.selectedDayId();
    if (!plan) return null;
    return plan.days?.find(d => d.id === id) ?? plan.days?.[0] ?? null;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.workoutSvc.getMyWorkoutPlans().pipe(
      catchError(() => {
        this.error.set(this.t.instant('workout.loadError'));
        return of([]);
      })
    ).subscribe(plans => {
      this.plans.set(plans);
      this.loading.set(false);
      setTimeout(() => {
        const totalPlans = this.filteredPlans().length;
        this.startCounter(totalPlans);
      }, 300);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  openPlan(plan: WorkoutPlanDto): void {
    this.loading.set(true);
    this.workoutSvc.getWorkoutPlanById(plan.id).pipe(
      catchError(() => {
        this.error.set(this.t.instant('workout.loadError'));
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(fullPlan => {
      if (!fullPlan) return;
      this.selectedPlan.set(fullPlan);
      this.selectedDayId.set(fullPlan.days?.[0]?.id ?? null);
      this.view.set('plan-detail');
      this.loading.set(false);
    });
  }

  openExercise(ex: WorkoutExerciseDto): void {
    this.selectedExercise.set(ex);
    this.view.set('exercise-detail');
  }

  goBack(): void {
    if (this.view() === 'plan-detail') {
      this.selectedPlan.set(null);
      this.view.set('plans');
    } else if (this.view() === 'exercise-detail') {
      this.selectedExercise.set(null);
      this.view.set('plan-detail');
    }
  }

  selectDay(dayId: string): void { this.selectedDayId.set(dayId); }

  // ── Plan Images ───────────────────────────────────────────────────────────────
  private readonly planImages: string[] = [
    'assets/images/scale.jpg',
    'assets/images/mat.jpg',
    'assets/images/dumble.jpg',
    'assets/images/weight.jpeg',
    'assets/images/calis.jpeg',
    'assets/images/stick.jpeg',
    'assets/images/steal.jpeg',
    'assets/images/hand.jpeg',
  ];

  getPlanImage(index: number): string {
    return this.planImages[index % this.planImages.length];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  getTotalExercises(plan: WorkoutPlanDto): number {
    return plan.days?.reduce((s, d) => s + (d.exercises?.length ?? 0), 0) ?? 0;
  }

  getEstimatedKcal(plan: WorkoutPlanDto): number {
    return this.getTotalExercises(plan) * 50;
  }

  isArabic(): boolean {
    return this.t.currentLang === 'ar';
  }

  getLocalizedName(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.nameAr || ex.name || ex.exercise?.name || '';
    }
    return ex.name || ex.exercise?.name || '';
  }

  getLocalizedDescription(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.descriptionAr || ex.exercise?.description || '';
    }
    return ex.exercise?.description || '';
  }

  getLocalizedEquipment(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.equipmentAr || ex.exercise?.equipment || '';
    }
    return ex.exercise?.equipment || '';
  }

  getLocalizedInstructions(ex: WorkoutExerciseDto): string[] {
    const field = this.isArabic() ? (ex.exercise?.instructionsAr || ex.exercise?.instructions) : ex.exercise?.instructions;
    return this.parseJsonArray(field);
  }

  getLocalizedBreathing(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.breathingAr || ex.exercise?.breathing || '';
    }
    return ex.exercise?.breathing || '';
  }

  getLocalizedCommonMistakes(ex: WorkoutExerciseDto): string[] {
    const field = this.isArabic() ? (ex.exercise?.commonMistakesAr || ex.exercise?.commonMistakes) : ex.exercise?.commonMistakes;
    return this.parseJsonArray(field);
  }

  getLocalizedSafetyTips(ex: WorkoutExerciseDto): string[] {
    const field = this.isArabic() ? (ex.exercise?.safetyTipsAr || ex.exercise?.safetyTips) : ex.exercise?.safetyTips;
    return this.parseJsonArray(field);
  }

  getLocalizedDifficulty(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.difficultyAr || ex.exercise?.difficulty || '';
    }
    return ex.exercise?.difficulty || '';
  }

  getLocalizedCategory(ex: WorkoutExerciseDto): string {
    if (this.isArabic()) {
      return ex.exercise?.categoryAr || ex.exercise?.category || '';
    }
    return ex.exercise?.category || '';
  }

  getLocalizedPrimaryMuscles(ex: WorkoutExerciseDto): string[] {
    const field = this.isArabic() ? (ex.exercise?.primaryMusclesAr || ex.exercise?.primaryMuscles) : ex.exercise?.primaryMuscles;
    return this.parseJsonArray(field);
  }

  getLocalizedSecondaryMuscles(ex: WorkoutExerciseDto): string[] {
    const field = this.isArabic() ? (ex.exercise?.secondaryMusclesAr || ex.exercise?.secondaryMuscles) : ex.exercise?.secondaryMuscles;
    return this.parseJsonArray(field);
  }

  muscleGroupIcon(group: string): string {
    const g = (group ?? '').toLowerCase();
    if (g.includes('chest'))    return '/assets/images/body.png';
    if (g.includes('back'))     return '/assets/images/back.png';
    if (g.includes('leg') || g.includes('quad') || g.includes('hamstring')) return '/assets/images/leg.png';
    if (g.includes('shoulder')) return '/assets/images/shoulders.png';
    if (g.includes('arm') || g.includes('bicep') || g.includes('tricep'))   return '/assets/images/arm.png';
    if (g.includes('core') || g.includes('ab'))   return '/assets/images/upper-body.png';
    if (g.includes('cardio'))   return '/assets/images/heart.png';
    if (g.includes('glute'))    return '/assets/images/back.png';
    return '/assets/images/human-body.png';
  }

  translateMuscleGroup(group: string): string {
    const g = (group ?? '').toLowerCase();
    const key = (() => {
      if (g.includes('chest'))         return 'workout.muscleGroups.chest';
      if (g.includes('back'))          return 'workout.muscleGroups.back';
      if (g.includes('shoulder'))      return 'workout.muscleGroups.shoulders';
      if (g.includes('bicep'))         return 'workout.muscleGroups.biceps';
      if (g.includes('tricep'))        return 'workout.muscleGroups.triceps';
      if (g.includes('leg'))           return 'workout.muscleGroups.legs';
      if (g.includes('quad'))          return 'workout.muscleGroups.quadriceps';
      if (g.includes('hamstring'))     return 'workout.muscleGroups.hamstrings';
      if (g.includes('glute'))         return 'workout.muscleGroups.glutes';
      if (g.includes('calve'))         return 'workout.muscleGroups.calves';
      if (g.includes('lower abdomin')) return 'workout.muscleGroups.lowerAbs';
      if (g.includes('abdomin'))       return 'workout.muscleGroups.abs';
      if (g.includes('oblique'))       return 'workout.muscleGroups.obliques';
      if (g.includes('abs'))           return 'workout.muscleGroups.abs';
      if (g.includes('core'))          return 'workout.muscleGroups.core';
      if (g.includes('forearm'))       return 'workout.muscleGroups.forearms';
      if (g.includes('arm'))           return 'workout.muscleGroups.arms';
      if (g.includes('full'))          return 'workout.muscleGroups.fullBody';
      if (g.includes('cardio'))        return 'workout.muscleGroups.cardio';
      return null;
    })();
    return key ? this.t.instant(key) : group;
  }

  getMuscleGroupColor(group: string): string {
    const g = (group ?? '').toLowerCase();
    if (g.includes('chest'))    return 'mg-chest';
    if (g.includes('back'))     return 'mg-back';
    if (g.includes('leg') || g.includes('quad') || g.includes('hamstring')) return 'mg-legs';
    if (g.includes('shoulder')) return 'mg-shoulder';
    if (g.includes('arm') || g.includes('bicep') || g.includes('tricep'))   return 'mg-arms';
    if (g.includes('core') || g.includes('ab'))   return 'mg-core';
    if (g.includes('cardio'))   return 'mg-cardio';
    return 'mg-default';
  }

  trackByPlan(_: number, p: WorkoutPlanDto)         { return p.id; }
  trackByDay(_: number, d: WorkoutDayDto)           { return d.id; }
  trackByExercise(_: number, e: WorkoutExerciseDto) { return e.id; }

  private weekdayMap: Record<string, string> = {
    'sunday':    'workout.sunday',
    'monday':    'workout.monday',
    'tuesday':   'workout.tuesday',
    'wednesday': 'workout.wednesday',
    'thursday':  'workout.thursday',
    'friday':    'workout.friday',
    'saturday':  'workout.saturday',
  };

  private dayFocusMap: Record<string, string> = {
    'upper body':          'workout.dayFocus.upperBody',
    'lower body and core': 'workout.dayFocus.lowerBodyCore',
    'lower body':          'workout.dayFocus.lowerBody',
    'full body':           'workout.dayFocus.fullBody',
    'push':                'workout.dayFocus.push',
    'pull':                'workout.dayFocus.pull',
    'legs':                'workout.dayFocus.legs',
    'core':                'workout.dayFocus.core',
    'cardio':              'workout.dayFocus.cardio',
  };

  translateDayName(dayName: string): string {
    if (!dayName) return dayName;

    const trimmed = dayName.trim();
    const lower = trimmed.toLowerCase();

    if (this.weekdayMap[lower]) {
      return this.t.instant(this.weekdayMap[lower]);
    }

    const match = trimmed.match(/^Day\s+(\d+)\s*-\s*(.+)$/i);
    if (match) {
      const dayNumber = match[1];
      const focusText = match[2].trim().toLowerCase();
      const key = this.dayFocusMap[focusText];
      const translatedFocus = key ? this.t.instant(key) : match[2].trim();
      return `${this.t.instant('workout.day')} ${dayNumber} - ${translatedFocus}`;
    }

    return dayName;
  }

  private weekdayOrder: Record<string, number> = {
    'saturday':  0,
    'sunday':    1,
    'monday':    2,
    'tuesday':   3,
    'wednesday': 4,
    'thursday':  5,
    'friday':    6,
  };

  private getDaySortKey(dayName: string): number {
    if (!dayName) return 999;
    const trimmed = dayName.trim().toLowerCase();

    if (this.weekdayOrder[trimmed] !== undefined) {
      return this.weekdayOrder[trimmed];
    }

    const match = trimmed.match(/^day\s+(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }

    return 999;
  }

  sortedDays(plan: any): any[] {
    return [...(plan.days ?? [])].sort(
      (a, b) => this.getDaySortKey(a.dayName) - this.getDaySortKey(b.dayName)
    );
  }

  getYouTubeEmbedUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.isKnownUnavailableVideo(url)) return null;
    if (url.includes('/results?') || url.includes('search_query=')) return null;

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return 'https://www.youtube.com/embed/' + match[2];
    }
    // Shorts support
    const shortsRegExp = /\/shorts\/([a-zA-Z0-9_-]{11})/;
    const shortsMatch = url.match(shortsRegExp);
    if (shortsMatch) {
      return 'https://www.youtube.com/embed/' + shortsMatch[1];
    }
    return null;
  }

  isKnownUnavailableVideo(url: string | null | undefined): boolean {
    if (!url) return false;
    return /UYCea886PPA/i.test(url);
  }

  canEmbedVideo(url: string | null | undefined): boolean {
    return !!this.getYouTubeEmbedUrl(url);
  }

  getSafeEmbedUrl(url: string | null | undefined): SafeResourceUrl | null {
    const embedUrl = this.getYouTubeEmbedUrl(url);
    if (embedUrl) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    }
    return null;
  }

  parseJsonArray(val: string | null | undefined): string[] {
    if (!val) return [];
    try {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return JSON.parse(trimmed);
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      return [val];
    }
  }
}