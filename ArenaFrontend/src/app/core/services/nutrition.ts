import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DailyNutritionSummaryDto,
  MealAnalysisResultDto,
  MealImageAnalysisDto,
  NutritionPlanDto,
} from '../models/nutrition';
import { map } from 'rxjs/operators';

const BASE = `${environment.apiUrl}/nutritionplans`;

@Injectable({ providedIn: 'root' })
export class NutritionService {
  private http = inject(HttpClient);

  getMyPlans(): Observable<NutritionPlanDto[]> {
  return this.http.get<any[]>(BASE).pipe(
    map(plans => plans.map(plan => ({
      ...plan,
      meals: plan.meals?.map((meal: any) => ({
        ...meal,
        proteinGrams: meal.proteinGrams ?? meal.protein ?? 0,
        carbsGrams:   meal.carbsGrams   ?? meal.carbs   ?? 0,
        fatGrams:     meal.fatGrams     ?? meal.fat      ?? 0,
      })) ?? []
    })))
  );
}
  getActivePlan(): Observable<NutritionPlanDto> {
    return this.http.get<NutritionPlanDto>(`${BASE}/active`);
  }

  getPlanById(id: string): Observable<NutritionPlanDto> {
    return this.http.get<NutritionPlanDto>(`${BASE}/${id}`);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  analyzeMealImage(image: File): Observable<MealImageAnalysisDto> {
    const formData = new FormData();
    formData.append('image', image);

    return this.http.post<MealImageAnalysisDto>(`${BASE}/analyze-meal-image`, formData);
  }

  /**
   * Analyzes a meal photo and logs it against the member's active plan. The
   * backend deducts the meal's calories from the daily target and returns the
   * recalculated day summary. Tolerates a backend that returns only the raw
   * analysis (no logging) by normalizing both shapes.
   */
  analyzeAndLogMeal(image: File): Observable<MealAnalysisResultDto> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('logMeal', 'true');

    return this.http.post<any>(`${BASE}/analyze-meal-image`, formData).pipe(
      map((res) =>
        res && 'analysis' in res
          ? (res as MealAnalysisResultDto)
          : { analysis: res as MealImageAnalysisDto, loggedMeal: null, dailySummary: null }
      )
    );
  }

  /** The backend's day-vs-target summary (target, consumed, remaining). */
  getDailySummary(date?: string): Observable<DailyNutritionSummaryDto> {
    const url = date
      ? `${BASE}/daily-summary?date=${encodeURIComponent(date)}`
      : `${BASE}/daily-summary`;
    return this.http.get<DailyNutritionSummaryDto>(url);
  }

  /** Undo a logged meal; returns the recalculated daily summary for that day. */
  deleteMealLog(mealLogId: string): Observable<DailyNutritionSummaryDto> {
    return this.http.delete<DailyNutritionSummaryDto>(`${BASE}/meal-logs/${mealLogId}`);
  }
}
