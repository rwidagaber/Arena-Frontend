import { Component, computed, inject, input, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutritionService } from '../../../core/services/nutrition';
import { NutritionPlanDto, MealDto, MealImageAnalysisDto, DailyNutritionSummaryDto } from '../../../core/models/nutrition';
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
export class Nutritionplan implements OnInit {
  private nutritionService = inject(NutritionService);
  private themeservice     = inject(ThemeService);
  readonly t               = inject(TranslationService);

  memberProfileId = input<string>('');

  // ── State ─────────────────────────────────────────────────────────────────────
  allPlans     = signal<NutritionPlanDto[]>([]); // كل الداتا من الـ API مرة واحدة
  selectedPlan = signal<NutritionPlanDto | null>(null);
  selectedMeal = signal<MealDto | null>(null);
  loading      = signal(true);
  error        = signal<string | null>(null);
  view         = signal<View>('plans');
  selectedMealImage = signal<File | null>(null);
  mealImagePreview = signal<string | null>(null);
  mealAnalysis = signal<MealImageAnalysisDto | null>(null);
  mealAnalysisLoading = signal(false);
  mealAnalysisError = signal<string | null>(null);
  dailySummary = signal<DailyNutritionSummaryDto | null>(null);

  // ── Search & Filter ───────────────────────────────────────────────────────────
  searchQuery    = signal('');
  showActiveOnly = signal(false);

  // ── Filtered (بدون API call) ──────────────────────────────────────────────────
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

  // ── Pagination (frontend-only) ────────────────────────────────────────────────
  currentPage = signal(0);
  readonly pageSize = 8;

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPlans().length / this.pageSize))
  );

  paginatedPlans = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredPlans().slice(start, start + this.pageSize);
  });

  // reset الصفحة لما يتغير الـ search أو الـ filter — بدون API call
  private resetPageOnFilter = effect(() => {
    this.searchQuery();
    this.showActiveOnly();
    this.currentPage.set(0);
  });

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      // scroll للأعلى عشان تجربة أحسن
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
    'assets/images/all.jpeg'

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

    const steps    = 50;
    const stepTime = 1500 / steps;
    const increment = target / steps;
    let current = 0;

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
  }

  // جيب الداتا مرة واحدة بس — الـ pagination والـ filter شغالين على الـ frontend
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

  // retry button في الـ template بيستخدم loadPlans
  loadPlans(): void {
    this.loadData();
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

    this.nutritionService.analyzeMealImage(file).subscribe({
      next: (result) => {
        this.mealAnalysis.set(result.analysis);
        if (result.dailySummary) {
          this.dailySummary.set(result.dailySummary);
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

  clearMealImageAnalysis(fileInput?: HTMLInputElement): void {
    const oldPreview = this.mealImagePreview();
    if (oldPreview) {
      URL.revokeObjectURL(oldPreview);
    }

    this.selectedMealImage.set(null);
    this.mealImagePreview.set(null);
    this.mealAnalysis.set(null);
    this.mealAnalysisError.set(null);

    if (fileInput) {
      fileInput.value = '';
    }
  }
}
