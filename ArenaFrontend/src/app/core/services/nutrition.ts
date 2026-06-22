import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MealImageAnalysisDto,
  NutritionPlanDto,
  MealAnalysisResultDto,
  DailyNutritionSummaryDto,
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

  /**
   * Analyzes a meal photo and logs it against the member's nutrition plan.
   * The backend returns the full result (analysis + logged meal + daily summary)
   * when logging succeeds, or just the raw analysis otherwise — this normalizes
   * both shapes into a MealAnalysisResultDto.
   */
  analyzeMealImage(image: File, logMeal: boolean = true): Observable<MealAnalysisResultDto> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('logMeal', String(logMeal));

    return this.http.post<any>(`${BASE}/analyze-meal-image`, formData).pipe(
      map((res) =>
        res && 'analysis' in res
          ? (res as MealAnalysisResultDto)
          : ({ analysis: res as MealImageAnalysisDto, loggedMeal: null, dailySummary: null })
      )
    );
  }

  getDailySummary(date?: string): Observable<DailyNutritionSummaryDto> {
    const url = date
      ? `${BASE}/daily-summary?date=${encodeURIComponent(date)}`
      : `${BASE}/daily-summary`;
    return this.http.get<DailyNutritionSummaryDto>(url);
  }
}
