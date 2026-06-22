export interface MealDto {
  id: string;
  mealType: string;
  name: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  // ✅ ضيف دول احتياطي لو الباك بيبعت بالأسماء دي
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients: string;
}

export interface NutritionPlanDto {
  id: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  isActive: boolean;
  meals: MealDto[];
}

export interface MacroPercentageDto {
  grams: number;
  percentage: number;
}

export interface MealImageAnalysisDto {
  mealName: string;
  summary: string;
  estimatedCalories: number;
  protein: MacroPercentageDto;
  carbs: MacroPercentageDto;
  fat: MacroPercentageDto;
  confidence: number;
  detectedFoods: string[];
  notes: string[];
}

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

export interface MealAnalysisResultDto {
  analysis: MealImageAnalysisDto;
  loggedMeal: MealLogResponseDto | null;
  dailySummary: DailyNutritionSummaryDto | null;
}
