import { Component, computed, inject, input, OnInit, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutritionService } from '../../../core/services/nutrition';
import {
  NutritionPlanDto,
  MealDto,
  MealImageAnalysisDto,
  DailyNutritionSummaryDto,
  MealLogResponseDto,
} from '../../../core/models/nutrition';
import { ThemeService } from '../../../core/services/themeservice';
type View = 'plans' | 'plan-detail' | 'meal-detail';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-nutritionplan',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './nutritionplan.html',
  styleUrl: './nutritionplan.css',
})
export class Nutritionplan implements OnInit, OnDestroy {
  private nutritionService = inject(NutritionService);
  private themeservice     = inject(ThemeService);
  readonly t               = inject(TranslationService);

  memberProfileId = input<string>('');

  // ── State ─────────────────────────────────────────────────────────────────────
  allPlans       = signal<NutritionPlanDto[]>([]);
  selectedPlan   = signal<NutritionPlanDto | null>(null);
  selectedMeal   = signal<MealDto | null>(null);
  loading        = signal(true);
  togglingPlanId = signal<string | null>(null);
  error          = signal<string | null>(null);
  view           = signal<View>('plans');

  // ── AI Meal Analysis ──────────────────────────────────────────────────────────
  selectedMealImage    = signal<File | null>(null);
  mealImagePreview     = signal<string | null>(null);
  mealAnalysis         = signal<MealImageAnalysisDto | null>(null);
  mealAnalysisLoading  = signal(false);
  mealAnalysisError    = signal<string | null>(null);
  lastLoggedMeal       = signal<MealLogResponseDto | null>(null);
  mealUndoLoading      = signal(false);

  // ── Daily Calorie Tracking ────────────────────────────────────────────────────
  dailySummary       = signal<DailyNutritionSummaryDto | null>(null);
  activePlan         = computed(() => this.allPlans().find(p => p.isActive) ?? null);
  activePlanCount    = computed(() => this.allPlans().filter(p => p.isActive).length);

  /** آخر plan في الـ array = أحدث plan اتضاف */
  latestPlanId = computed(() => {
    const plans = this.allPlans();
    return plans.length ? plans[plans.length - 1].id : null;
  });

  dailyCalorieTarget = computed(
    () => this.dailySummary()?.dailyCalorieTarget ?? this.activePlan()?.dailyCalories ?? 0
  );
  consumedCalories  = computed(() => this.dailySummary()?.consumedCalories ?? 0);
  remainingCalories = computed(() => {
    const s = this.dailySummary();
    return s ? s.remainingCalories : this.dailyCalorieTarget() - this.consumedCalories();
  });
  isOverTarget = computed(() => {
    const s = this.dailySummary();
    return s ? s.isOverTarget : this.dailyCalorieTarget() > 0 && this.remainingCalories() < 0;
  });
  progressPercent = computed(() => {
    const target = this.dailyCalorieTarget();
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.consumedCalories() / target) * 100));
  });

  // ── Search & Filter ───────────────────────────────────────────────────────────
  searchQuery    = signal('');
  showActiveOnly = signal(false);

  filteredPlans = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    let result = this.allPlans();

    if (this.showActiveOnly()) {
      result = result.filter(p => p.isActive);
    }

    if (q) {
      result = result.filter(p =>
        p.dailyCalories.toString().includes(q) ||
        `diet plan ${p.dailyCalories}`.toLowerCase().includes(q) ||
        p.meals.some(m =>
          m.name.toLowerCase().includes(q) ||
          m.mealType.toLowerCase().includes(q) ||
          m.ingredients.toLowerCase().includes(q)
        )
      );
    }

    return result;
  });

  // ── Pagination ────────────────────────────────────────────────────────────────
  currentPage = signal(0);
  readonly pageSize = 8;

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPlans().length / this.pageSize))
  );

  paginatedPlans = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredPlans().slice(start, start + this.pageSize);
  });

  private resetPageOnFilter = effect(() => {
    this.searchQuery();
    this.showActiveOnly();
    this.currentPage.set(0);
  });

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  pageArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  // ── Meal Type Tabs ────────────────────────────────────────────────────────────
  activeMealTab = signal<string>('all');

  mealTabs = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return [];
    const types = [...new Set(plan.meals.map(m => m.mealType))];
    return ['all', ...types];
  });

  filteredMeals = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return [];
    const tab = this.activeMealTab();
    if (tab === 'all') return plan.meals;
    return plan.meals.filter(m => m.mealType.toLowerCase() === tab.toLowerCase());
  });

  // ── Plan Images ───────────────────────────────────────────────────────────────
  private readonly planImages: string[] = [
    'assets/images/veg.jpg',
    'assets/images/nut.png',
    'assets/images/fruit.png',
    'assets/images/break.jpg',
    'assets/images/dinner.jpg',
    'assets/images/lunch.jpg',
    'assets/images/fruit.jpg',
    'assets/images/all.jpeg',
  ];

  getPlanImage(index: number): string {
    return this.planImages[index % this.planImages.length];
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  isDarkMode = computed(() => this.themeservice.isDark);

  // ── Animated Counter ──────────────────────────────────────────────────────────
  animatedCount = signal<number>(0);

  startCounter(target: number): void {
    this.animatedCount.set(0);
    if (target === 0) return;
    const steps     = 50;
    const stepTime  = 1500 / steps;
    const increment = target / steps;
    let current     = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        this.animatedCount.set(target);
        clearInterval(timer);
      } else {
        this.animatedCount.set(Math.ceil(current));
      }
    }, stepTime);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadData();
    this.loadDailySummary();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.nutritionService.getMyPlans().pipe(
      catchError(() => {
        this.error.set(this.t.translate('nutrition.loadError'));
        return of([]);
      })
    ).subscribe(plans => {
      this.allPlans.set(plans);
      this.loading.set(false);
      setTimeout(() => this.startCounter(plans.length), 300);
    });
  }

  loadPlans(): void {
    this.loadData();
  }

  loadDailySummary(): void {
    this.nutritionService.getDailySummary().subscribe({
      next:  (summary) => this.dailySummary.set(summary),
      error: ()        => this.dailySummary.set(null),
    });
  }

  // ── Toggle Active Plan ────────────────────────────────────────────────────────
  togglePlanActive(plan: NutritionPlanDto, event: Event): void {
    event.stopPropagation();
    if (this.togglingPlanId()) return;
    const activate = !plan.isActive;
    this.togglingPlanId.set(plan.id);
    this.nutritionService.setPlanActive(plan.id, activate).subscribe({
      next: () => {
        this.loadData();
        this.loadDailySummary();
        const selected = this.selectedPlan();
        if (selected && selected.id === plan.id) {
          this.selectedPlan.set({ ...selected, isActive: activate });
        }
        this.togglingPlanId.set(null);
      },
      error: (err) => {
        const e = err?.error;
        const msg = Array.isArray(e) ? e[0] : (typeof e === 'string' ? e : this.t.translate('nutrition.planUpdateFailed'));
        this.error.set(msg);
        this.togglingPlanId.set(null);
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  openPlan(plan: NutritionPlanDto): void {
    this.selectedPlan.set(plan);
    this.selectedMeal.set(null);
    this.activeMealTab.set('all');
    this.view.set('plan-detail');
  }

  goBack(): void {
    if (this.view() === 'meal-detail') {
      this.selectedMeal.set(null);
      this.view.set('plan-detail');
    } else {
      this.selectedPlan.set(null);
      this.activeMealTab.set('all');
      this.view.set('plans');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  getMealTypeColor(type: string): string {
    const t = type?.toLowerCase();
    if (t === 'breakfast') return 'meal-breakfast';
    if (t === 'lunch')     return 'meal-lunch';
    if (t === 'dinner')    return 'meal-dinner';
    return 'meal-snack';
  }

  private readonly mealTypeKeyMap: Record<string, string> = {
    breakfast: 'nutrition.breakfast',
    lunch:     'nutrition.lunch',
    dinner:    'nutrition.dinner',
    snack:     'nutrition.snack',
  };

  translateMealType(type: string): string {
    if (!type) return type;
    const key = this.mealTypeKeyMap[type.toLowerCase()];
    return key ? this.t.translate(key) : type;
  }

  // ── AI Meal Analysis ──────────────────────────────────────────────────────────
  onMealImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    this.mealAnalysis.set(null);
    this.mealAnalysisError.set(null);
    this.selectedMealImage.set(file);
    const oldPreview = this.mealImagePreview();
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    if (!file) { this.mealImagePreview.set(null); return; }
    if (!file.type.startsWith('image/')) {
      this.mealImagePreview.set(null);
      this.selectedMealImage.set(null);
      this.mealAnalysisError.set(this.t.translate('nutrition.mealImageInvalid'));
      return;
    }
    this.mealImagePreview.set(URL.createObjectURL(file));
  }

  analyzeSelectedMealImage(): void {
    const file = this.selectedMealImage();
    if (!file || this.mealAnalysisLoading()) return;
    this.mealAnalysisLoading.set(true);
    this.mealAnalysisError.set(null);
    this.nutritionService.analyzeAndLogMeal(file).subscribe({
      next: (result) => {
        this.mealAnalysis.set(result.analysis);
        this.lastLoggedMeal.set(result.loggedMeal ?? null);
        if (result.dailySummary) {
          this.dailySummary.set(result.dailySummary);
        } else {
          this.loadDailySummary();
        }
        this.mealAnalysisLoading.set(false);
      },
      error: (error) => {
        const message = error?.message
          ? error.message
          : typeof error?.error === 'string'
          ? error.error
          : this.t.translate('nutrition.mealImageError');
        this.mealAnalysisError.set(message);
        this.mealAnalysisLoading.set(false);
      },
    });
  }

  undoLastMeal(): void {
    const logged = this.lastLoggedMeal();
    if (!logged || this.mealUndoLoading()) return;
    this.mealUndoLoading.set(true);
    this.nutritionService.deleteMealLog(logged.id).subscribe({
      next: (summary) => {
        this.dailySummary.set(summary);
        this.lastLoggedMeal.set(null);
        this.mealAnalysis.set(null);
        this.mealUndoLoading.set(false);
      },
      error: (error) => {
        const message = error?.message
          ? error.message
          : typeof error?.error === 'string'
          ? error.error
          : this.t.translate('nutrition.mealImageError');
        this.mealAnalysisError.set(message);
        this.mealUndoLoading.set(false);
      },
    });
  }

  clearMealImageAnalysis(fileInput?: HTMLInputElement): void {
    const oldPreview = this.mealImagePreview();
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    this.selectedMealImage.set(null);
    this.mealImagePreview.set(null);
    this.mealAnalysis.set(null);
    this.mealAnalysisError.set(null);
    this.lastLoggedMeal.set(null);
    if (fileInput) fileInput.value = '';
  }

  ngOnDestroy(): void {
    const preview = this.mealImagePreview();
    if (preview) URL.revokeObjectURL(preview);
  }
}