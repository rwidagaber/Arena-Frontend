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