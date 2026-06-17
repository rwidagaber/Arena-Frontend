import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { WorkoutPlanDto } from '../models/workout';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/WorkoutPlans`;

  /** GET /api/WorkoutPlans – all plans for the logged-in member */
  getMyWorkoutPlans(): Observable<WorkoutPlanDto[]> {
    return this.http.get<WorkoutPlanDto[]>(this.base);
  }

  /** GET /api/WorkoutPlans/active – active plan only */
  getActiveWorkoutPlan(): Observable<WorkoutPlanDto> {
    return this.http.get<WorkoutPlanDto>(`${this.base}/active`);
  }

  /** GET /api/WorkoutPlans/:id */
  getWorkoutPlanById(id: string): Observable<WorkoutPlanDto> {
    return this.http.get<WorkoutPlanDto>(`${this.base}/${id}`);
  }

  /** DELETE /api/WorkoutPlans/:id */
  deleteWorkoutPlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}