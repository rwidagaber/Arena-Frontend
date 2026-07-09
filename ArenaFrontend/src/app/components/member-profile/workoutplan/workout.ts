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

  // ── Video state ────────────────────────────────────────────────────────────────
  playVideo = signal(false);
  videoLoading = signal(false);
  // Cache the sanitized embed URL per source URL. `bypassSecurityTrustResourceUrl`
  // returns a NEW object each call, so calling it straight from the template
  // binding makes Angular re-set the iframe `src` on every change-detection pass —
  // reloading the player constantly so the video never actually plays.
  private safeEmbedUrlCache = new Map<string, SafeResourceUrl>();

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
    this.playVideo.set(false);
    this.videoLoading.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack(): void {
    if (this.view() === 'plan-detail') {
      this.selectedPlan.set(null);
      this.view.set('plans');
    } else if (this.view() === 'exercise-detail') {
      this.selectedExercise.set(null);
      this.playVideo.set(false);
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
    const desc = this.isArabic()
      ? (ex.exercise?.descriptionAr || ex.exercise?.description || '')
      : (ex.exercise?.description || '');
    return desc.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '').trim();
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

  /**
   * Canonical muscle-group token from a raw value the AI may have stored in
   * EITHER English or Arabic — it writes each plan in whatever language the
   * member spoke. Label, colour, and icon all key off this token so the page
   * renders in the current UI language regardless of how it was saved.
   */
  private normalizeMuscleGroup(group: string): string | null {
    const g = (group ?? '').toLowerCase().trim();
    if (!g) return null;
    const has = (...terms: string[]) => terms.some(term => g.includes(term));
    if (has('chest', 'صدر'))                              return 'chest';
    if (has('lat', 'back', 'ظهر'))                        return 'back';
    if (has('shoulder', 'delt', 'كتف', 'اكتاف', 'أكتاف')) return 'shoulders';
    if (has('bicep', 'بايسبس', 'ذات الرأسين'))            return 'biceps';
    if (has('tricep', 'ترايسبس', 'ثلاثية الرؤوس'))        return 'triceps';
    if (has('forearm', 'ساعد'))                           return 'forearms';
    if (has('quad', 'الفخذ الأمامي', 'فخذ أمامي'))        return 'quadriceps';
    if (has('hamstring', 'الفخذ الخلفي', 'فخذ خلفي'))     return 'hamstrings';
    if (has('glute', 'أرداف', 'ارداف', 'مؤخرة'))          return 'glutes';
    if (has('calve', 'calf', 'سمانة', 'بطة الساق'))       return 'calves';
    if (has('leg', 'أرجل', 'ارجل', 'رجل', 'الساق'))       return 'legs';
    if (has('lower ab', 'أسفل البطن', 'بطن سفلي'))        return 'lowerAbs';
    if (has('oblique', 'جانبية', 'الخصر'))                return 'obliques';
    if (has('ab', 'بطن', 'معدة'))                         return 'abs';
    if (has('core', 'جذع', 'وسط الجسم'))                  return 'core';
    if (has('arm', 'ذراع', 'اذرع', 'أذرع'))               return 'arms';
    if (has('cardio', 'كارديو', 'هوائي'))                 return 'cardio';
    if (has('full', 'كامل', 'كل الجسم'))                  return 'fullBody';
    return null;
  }

  muscleGroupIcon(group: string): string {
    switch (this.normalizeMuscleGroup(group)) {
      case 'chest':                                 return '/assets/images/body.png';
      case 'back':
      case 'glutes':                                return '/assets/images/back.png';
      case 'legs':
      case 'quadriceps':
      case 'hamstrings':
      case 'calves':                                return '/assets/images/leg.png';
      case 'shoulders':                             return '/assets/images/shoulders.png';
      case 'arms':
      case 'biceps':
      case 'triceps':
      case 'forearms':                              return '/assets/images/arm.png';
      case 'core':
      case 'abs':
      case 'obliques':
      case 'lowerAbs':                              return '/assets/images/upper-body.png';
      case 'cardio':                                return '/assets/images/heart.png';
      default:                                      return '/assets/images/human-body.png';
    }
  }

  translateMuscleGroup(group: string): string {
    const token = this.normalizeMuscleGroup(group);
    return token ? this.t.instant('workout.muscleGroups.' + token) : group;
  }

  getMuscleGroupColor(group: string): string {
    switch (this.normalizeMuscleGroup(group)) {
      case 'chest':                                 return 'mg-chest';
      case 'back':                                  return 'mg-back';
      case 'legs':
      case 'quadriceps':
      case 'hamstrings':
      case 'glutes':
      case 'calves':                                return 'mg-legs';
      case 'shoulders':                             return 'mg-shoulder';
      case 'arms':
      case 'biceps':
      case 'triceps':
      case 'forearms':                              return 'mg-arms';
      case 'abs':
      case 'core':
      case 'obliques':
      case 'lowerAbs':                              return 'mg-core';
      case 'cardio':                                return 'mg-cardio';
      default:                                      return 'mg-default';
    }
  }

  /** Canonical difficulty token from an English- or Arabic-stored value. */
  private normalizeDifficulty(raw: string): string {
    const d = (raw ?? '').toLowerCase().trim();
    if (!d) return '';
    if (d.includes('beginner') || d.includes('مبتدئ') || d.includes('سهل'))   return 'beginner';
    if (d.includes('intermediate') || d.includes('متوسط'))                    return 'intermediate';
    if (d.includes('advanced') || d.includes('متقدم') || d.includes('صعب'))    return 'advanced';
    return '';
  }

  /** CSS modifier for the difficulty tag (beginner / intermediate / advanced). */
  difficultyClass(ex: WorkoutExerciseDto): string {
    return this.normalizeDifficulty(this.getLocalizedDifficulty(ex));
  }

  /** Difficulty label in the current UI language, whatever language it was saved in. */
  translateDifficulty(ex: WorkoutExerciseDto): string {
    const token = this.normalizeDifficulty(this.getLocalizedDifficulty(ex));
    return token ? this.t.instant('workout.difficultyLevels.' + token) : this.getLocalizedDifficulty(ex);
  }

  trackByPlan(_: number, p: WorkoutPlanDto)         { return p.id; }
  trackByDay(_: number, d: WorkoutDayDto)           { return d.id; }
  trackByExercise(_: number, e: WorkoutExerciseDto) { return e.id; }

  private weekdayMap: Record<string, string> = {
    'sunday':    'workout.sunday',    'الأحد':    'workout.sunday',    'الاحد':    'workout.sunday',
    'monday':    'workout.monday',    'الاثنين':  'workout.monday',    'الإثنين':  'workout.monday',   'الأثنين': 'workout.monday',
    'tuesday':   'workout.tuesday',   'الثلاثاء': 'workout.tuesday',
    'wednesday': 'workout.wednesday', 'الأربعاء': 'workout.wednesday', 'الاربعاء': 'workout.wednesday',
    'thursday':  'workout.thursday',  'الخميس':   'workout.thursday',
    'friday':    'workout.friday',    'الجمعة':   'workout.friday',
    'saturday':  'workout.saturday',  'السبت':    'workout.saturday',
  };

  /**
   * Resolve a day's "focus" (the part after "Day N -") to a translation key,
   * accepting the AI's English or Arabic wording so it shows in the current UI
   * language either way.
   */
  private resolveDayFocusKey(focus: string): string | null {
    const f = (focus ?? '').toLowerCase().trim();
    if (!f) return null;
    const has = (...terms: string[]) => terms.some(term => f.includes(term));
    if (has('lower body and core', 'lower body & core', 'السفلي والجذع', 'سفلي والجذع')) return 'workout.dayFocus.lowerBodyCore';
    if (has('upper', 'الجزء العلوي', 'علوي'))  return 'workout.dayFocus.upperBody';
    if (has('lower', 'الجزء السفلي', 'سفلي'))  return 'workout.dayFocus.lowerBody';
    if (has('full', 'الجسم بالكامل', 'كامل'))  return 'workout.dayFocus.fullBody';
    if (has('push', 'دفع'))                     return 'workout.dayFocus.push';
    if (has('pull', 'سحب'))                     return 'workout.dayFocus.pull';
    if (has('leg', 'أرجل', 'ارجل', 'رجل'))     return 'workout.dayFocus.legs';
    if (has('core', 'الجذع', 'جذع'))           return 'workout.dayFocus.core';
    if (has('cardio', 'كارديو'))                return 'workout.dayFocus.cardio';
    return null;
  }

  translateDayName(dayName: string): string {
    if (!dayName) return dayName;

    const trimmed = dayName.trim();
    const lower = trimmed.toLowerCase();

    if (this.weekdayMap[lower]) {
      return this.t.instant(this.weekdayMap[lower]);
    }

    // "Day 3 - Upper Body" / "اليوم 3 - الجزء العلوي" / "يوم 3"
    const match = trimmed.match(/^(?:day|اليوم|يوم)\s*(\d+)\s*[-:–—]?\s*(.*)$/i);
    if (match) {
      const dayNumber = match[1];
      const dayWord = this.t.instant('workout.day');
      const focusRaw = (match[2] ?? '').trim();
      if (!focusRaw) return `${dayWord} ${dayNumber}`;
      const key = this.resolveDayFocusKey(focusRaw);
      const translatedFocus = key ? this.t.instant(key) : focusRaw;
      return `${dayWord} ${dayNumber} - ${translatedFocus}`;
    }

    return dayName;
  }

  private weekdayOrder: Record<string, number> = {
    'saturday':  0, 'السبت':    0,
    'sunday':    1, 'الأحد':    1, 'الاحد':    1,
    'monday':    2, 'الاثنين':  2, 'الإثنين':  2, 'الأثنين': 2,
    'tuesday':   3, 'الثلاثاء': 3,
    'wednesday': 4, 'الأربعاء': 4, 'الاربعاء': 4,
    'thursday':  5, 'الخميس':   5,
    'friday':    6, 'الجمعة':   6,
  };

  private getDaySortKey(dayName: string): number {
    if (!dayName) return 999;
    const trimmed = dayName.trim().toLowerCase();

    if (this.weekdayOrder[trimmed] !== undefined) {
      return this.weekdayOrder[trimmed];
    }

    const match = trimmed.match(/^(?:day|اليوم|يوم)\s*(\d+)/);
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

  getYouTubeVideoId(url: string | null | undefined): string | null {
    if (!url) return null;
    const patterns = [
      /\/shorts\/([a-zA-Z0-9_-]{11})/,
      /\/live\/([a-zA-Z0-9_-]{11})/,
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) {
        const id = m[1]?.length === 11 ? m[1] : (m[2]?.length === 11 ? m[2] : null);
        if (id) return id;
      }
    }
    return null;
  }

  getYouTubeEmbedUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (this.isKnownUnavailableVideo(url)) return null;
    if (url.includes('/results?') || url.includes('search_query=')) return null;
    const id = this.getYouTubeVideoId(url);
    if (!id) return null;
    // Use youtube-nocookie.com — privacy-enhanced domain that sometimes works
    // when the regular youtube.com embed shows "Video unavailable".
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }

  isKnownUnavailableVideo(url: string | null | undefined): boolean {
    if (!url) return false;
    return /UYCea886PPA/i.test(url);
  }

  getYouTubeThumbnailUrl(url: string | null | undefined): string | null {
    const id = this.getYouTubeVideoId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }

  canEmbedVideo(url: string | null | undefined): boolean {
    return !!this.getYouTubeEmbedUrl(url);
  }

  onVideoPlay(): void {
    this.playVideo.set(true);
    this.videoLoading.set(true);
    // Safety net: cross-origin YouTube iframes don't always fire a `load` event,
    // which would otherwise leave the spinner stuck over a playing video. Clear
    // the loading state after a short delay regardless.
    setTimeout(() => this.videoLoading.set(false), 2500);
  }

  onVideoIframeLoad(): void {
    this.videoLoading.set(false);
  }

  getSafeEmbedUrl(url: string | null | undefined): SafeResourceUrl | null {
    const embedUrl = this.getYouTubeEmbedUrl(url);
    if (!embedUrl) return null;
    let safe = this.safeEmbedUrlCache.get(embedUrl);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      this.safeEmbedUrlCache.set(embedUrl, safe);
    }
    return safe;
  }

  hasMuscles(ex: WorkoutExerciseDto): boolean {
    return this.getLocalizedPrimaryMuscles(ex).length > 0 || this.getLocalizedSecondaryMuscles(ex).length > 0;
  }

  hasEquipment(ex: WorkoutExerciseDto): boolean {
    const eq = this.getLocalizedEquipment(ex);
    return !!eq && eq.trim().toLowerCase() !== 'none';
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