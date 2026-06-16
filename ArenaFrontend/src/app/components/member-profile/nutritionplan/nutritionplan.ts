import { Component, computed, inject, input, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NutritionService } from '../../../core/services/nutrition';
import { NutritionPlanDto, MealDto } from '../../../core/models/nutrition';
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
  error        = signal<string | null>(null);
  view         = signal<View>('plans');

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
    'assets/images/fruit.png'
  ];
  langSub: any;

  getPlanImage(index: number): string {
    return this.planImages[index % this.planImages.length];
  }

  // ── Lifecycle ──────────────────────────────────────
  ngOnInit(): void {
    this.loadPlans();
  }

 

 isDarkMode = computed(() => this.themeservice.isDark);

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);
    this.nutritionService.getMyPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
console.log('Loaded nutrition plans:', JSON.stringify(plans, null, 2));        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load nutrition plans');
        this.loading.set(false);
      }
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
}