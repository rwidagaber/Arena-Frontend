import { MealImageAnalysisDto } from '../../../core/models/nutrition';

/**
 * A single meal the member has logged today (returned by the backend after a
 * photo is analyzed and persisted against their nutrition plan).
 */
export interface MealLogResponseDto {
  id: string;
  imageUrl: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodItems: string;
  aiComment: string;
  logDate: string;
}

/**
 * Aggregate of the member's day vs. their plan target — the source of the
 * "remaining calories" figure shown after each meal is entered.
 */
export interface DailyNutritionSummaryDto {
  date: string;
  hasActivePlan: boolean;
  nutritionPlanId: string | null;
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailyCarbsTarget: number;
  dailyFatTarget: number;
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  mealsLoggedToday: number;
  isOverTarget: boolean;
  message: string;
}

/**
 * Full response of the analyze-meal-image endpoint when logging succeeds:
 * the raw vision analysis, the persisted meal, and the recalculated day summary.
 */
export interface MealAnalysisResultDto {
  analysis: MealImageAnalysisDto;
  loggedMeal: MealLogResponseDto | null;
  dailySummary: DailyNutritionSummaryDto | null;
}
