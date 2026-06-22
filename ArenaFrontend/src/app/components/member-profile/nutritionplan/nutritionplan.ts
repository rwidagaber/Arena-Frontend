import { Component, computed, inject, input, OnInit, signal, effect } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-nutritionplan',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './nutritionplan.html',
  styleUrl: './nutritionplan.css',
})
export class Nutritionplan implements OnInit {
  private nutritionService = inject(NutritionService);
  private themeservice = inject(ThemeService);
  private translate = inject(TranslationService);
  readonly t        = inject(TranslationService);

  memberProfileId = input<string>('');

  
  plans        = signal<NutritionPlanDto[]>([]);
  selectedPlan = signal<NutritionPlanDto | null>(null);
  selectedMeal = signal<MealDto | null>(null);
  loading      = signal(true);
  /** Id of the plan whose active state is currently being toggled. */
  togglingPlanId = signal<string | null>(null);
  error        = signal<string | null>(null);
  view         = signal<View>('plans');
  selectedMealImage = signal<File | null>(null);
  mealImagePreview = signal<string | null>(null);
  mealAnalysis = signal<MealImageAnalysisDto | null>(null);
  mealAnalysisLoading = signal(false);
  mealAnalysisError = signal<string | null>(null);
  /** The meal just logged by the last analysis, available to undo. */
  lastLoggedMeal = signal<MealLogResponseDto | null>(null);
  mealUndoLoading = signal(false);

  // ── Daily calorie target tracking (backend-driven) ────────────────────────
  // The backend logs each analyzed meal against the active plan and returns the
  // recalculated day summary, where the calorie deduction (target − consumed)
  // is computed server-side. We just render those values.
  /** The backend's day-vs-target summary; null until loaded / no active plan. */
  dailySummary = signal<DailyNutritionSummaryDto | null>(null);
  /** Active plan, used as a fallback target source before the summary loads. */
  activePlan = computed(() => this.plans().find((p) => p.isActive) ?? null);
  /** Daily calorie target (backend summary, falling back to the active plan). */
  dailyCalorieTarget = computed(
    () => this.dailySummary()?.dailyCalorieTarget ?? this.activePlan()?.dailyCalories ?? 0
  );
  /** Calories consumed today, per the backend. */
  consumedCalories = computed(() => this.dailySummary()?.consumedCalories ?? 0);
  /** Calories remaining against the target (target − consumed). */
  remainingCalories = computed(() => {
    const s = this.dailySummary();
    return s ? s.remainingCalories : this.dailyCalorieTarget() - this.consumedCalories();
  });
  /** True once consumed calories exceed the daily target. */
  isOverTarget = computed(() => {
    const s = this.dailySummary();
    return s ? s.isOverTarget : this.dailyCalorieTarget() > 0 && this.remainingCalories() < 0;
  });
  /** 0–100 fill of consumed vs target, for the persistent daily bar. */
  progressPercent = computed(() => {
    const target = this.dailyCalorieTarget();
    if (target <= 0) return 0;
    return Math.min(100, Math.round((this.consumedCalories() / target) * 100));
  });

  // ── Search & Filter ────────────────────────────────
  searchQuery    = signal('');
  showActiveOnly = signal(false);

  filteredPlans = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    let result = this.plans();

    if (this.showActiveOnly()) {
      result = result.filter(plan => plan.isActive);
    }

    if (q) {
      result = result.filter(plan =>
        plan.dailyCalories.toString().includes(q) ||
        `diet plan ${plan.dailyCalories}`.toLowerCase().includes(q) ||
        plan.meals.some(meal =>
          meal.name.toLowerCase().includes(q) ||
          meal.mealType.toLowerCase().includes(q) ||
          meal.ingredients.toLowerCase().includes(q)
        )
      );
    }

    return result;
  });

  // ── Meal Type Tabs ─────────────────────────────────
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
    return plan.meals.filter(m =>
      m.mealType.toLowerCase() === tab.toLowerCase()
    );
  });

  // ── Plan Images ────────────────────────────────────
  planImages: string[] = [
    'assets/images/veg.jpg',
    'assets/images/nut.png',
    'assets/images/fruit.png',
    'assets/images/break.jpg',
    'assets/images/dinner.jpg',
    'assets/images/lunch.jpg',
    'assets/images/fruit.jpg',
  ];
  langSub: any;

  getPlanImage(index: number): string {
    return this.planImages[index % this.planImages.length];
  }

  // ── Lifecycle ──────────────────────────────────────
  ngOnInit(): void {
    this.loadPlans();
    this.loadDailySummary();
  }

  /** Fetches the backend's day-vs-target summary (target, consumed, remaining). */
  loadDailySummary(): void {
    this.nutritionService.getDailySummary().subscribe({
      next: (summary) => this.dailySummary.set(summary),
      error: () => this.dailySummary.set(null),
    });
  }

 

 isDarkMode = computed(() => this.themeservice.isDark);

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    this.nutritionService.getMyPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
      this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load nutrition plans');
        this.loading.set(false);
      }
    });
  }

  togglePlanActive(plan: NutritionPlanDto, event: Event): void {
    event.stopPropagation(); // don't open the plan while toggling its state
    if (this.togglingPlanId()) return;

    const activate = !plan.isActive;
    this.togglingPlanId.set(plan.id);
    this.nutritionService.setPlanActive(plan.id, activate).subscribe({
      next: () => {
        // Single active plan: reload so the other cards reflect the change,
        // and refresh the daily summary since the active target may have moved.
        this.loadPlans();
        this.loadDailySummary();
        // Keep the open plan-detail view in sync with the new active state.
        const selected = this.selectedPlan();
        if (selected && selected.id === plan.id) {
          this.selectedPlan.set({ ...selected, isActive: activate });
        }
        this.togglingPlanId.set(null);
      },
      error: () => {
        this.error.set(this.t.translate('nutrition.planUpdateFailed'));
        this.togglingPlanId.set(null);
      },
    });
  }

  // ── Navigation ─────────────────────────────────────
  openPlan(plan: NutritionPlanDto): void {
    this.selectedPlan.set(plan);
    this.selectedMeal.set(null);
    this.activeMealTab.set('all'); // ✅ reset tab
    this.view.set('plan-detail');
  }

  // openMeal(meal: MealDto): void {
  //   this.selectedMeal.set(meal);
  //   this.view.set('meal-detail');
  // }

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

  // ── Helpers ────────────────────────────────────────
  getMealTypeColor(type: string): string {
    const t = type?.toLowerCase();
    if (t === 'breakfast') return 'meal-breakfast';
    if (t === 'lunch')     return 'meal-lunch';
    if (t === 'dinner')    return 'meal-dinner';
    return 'meal-snack';
  }
private mealTypeKeyMap: Record<string, string> = {
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

  onMealImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.mealAnalysis.set(null);
    this.mealAnalysisError.set(null);
    this.selectedMealImage.set(file);

    const oldPreview = this.mealImagePreview();
    if (oldPreview) {
      URL.revokeObjectURL(oldPreview);
    }

    if (!file) {
      this.mealImagePreview.set(null);
      return;
    }

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
        // Remember the persisted meal so the user can undo this log.
        this.lastLoggedMeal.set(result.loggedMeal ?? null);
        // The backend logged the meal and deducted it from the daily target.
        // Use the returned summary, or refetch it if the backend didn't echo one.
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
      }
    });
  }

  undoLastMeal(): void {
    const logged = this.lastLoggedMeal();
    if (!logged || this.mealUndoLoading()) return;

    this.mealUndoLoading.set(true);
    this.nutritionService.deleteMealLog(logged.id).subscribe({
      next: (summary) => {
        // Meal removed: refresh the day's deduction and drop the analysis card.
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
    if (oldPreview) {
      URL.revokeObjectURL(oldPreview);
    }

    this.selectedMealImage.set(null);
    this.mealImagePreview.set(null);
    this.mealAnalysis.set(null);
    this.mealAnalysisError.set(null);
    this.lastLoggedMeal.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }
}
