import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NutritionPlanDto } from '../models/nutrition';
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
}