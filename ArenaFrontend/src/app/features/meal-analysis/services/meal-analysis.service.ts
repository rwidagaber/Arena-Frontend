import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { MealImageAnalysisDto } from '../../../core/models/nutrition';
import {
  MealLogResponseDto,
  DailyNutritionSummaryDto,
  MealAnalysisResultDto,
} from '../models/meal-analysis.models';

const BASE = `${environment.apiUrl}/nutritionplans`;

/**
 * Self-contained state + API for the meal-analysis feature.
 *
 * Holds the day's summary and logged meals as signals so the scanner, the
 * remaining-calories card and the meals list all stay in sync: logging a meal
 * updates every view live without a refetch.
 */
@Injectable({ providedIn: 'root' })
export class MealAnalysisService {
  private http = inject(HttpClient);

  readonly summary = signal<DailyNutritionSummaryDto | null>(null);
  readonly meals = signal<MealLogResponseDto[]>([]);
  readonly loading = signal(false);
  private loaded = false;

  /**
   * Sends a meal photo for analysis. When logging succeeds the backend returns
   * the full result (analysis + logged meal + day summary); otherwise it returns
   * the raw analysis only — both shapes are normalized to MealAnalysisResultDto.
   */
  analyzeMealImage(image: File, logMeal: boolean = true): Observable<MealAnalysisResultDto> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('logMeal', String(logMeal));

    return this.http.post<any>(`${BASE}/analyze-meal-image`, formData).pipe(
      map((res) =>
        res && 'analysis' in res
          ? (res as MealAnalysisResultDto)
          : { analysis: res as MealImageAnalysisDto, loggedMeal: null, dailySummary: null }
      )
    );
  }

  getDailySummary(date?: string): Observable<DailyNutritionSummaryDto> {
    const url = date
      ? `${BASE}/daily-summary?date=${encodeURIComponent(date)}`
      : `${BASE}/daily-summary`;
    return this.http.get<DailyNutritionSummaryDto>(url);
  }

  getTodayMeals(date?: string): Observable<MealLogResponseDto[]> {
    const url = date
      ? `${BASE}/meal-logs?date=${encodeURIComponent(date)}`
      : `${BASE}/meal-logs`;
    return this.http.get<MealLogResponseDto[]>(url);
  }

  /**
   * Hydrates today's summary and meals. Each request degrades gracefully: if the
   * meal-logs endpoint isn't available yet, whatever was accumulated this session
   * is kept rather than cleared.
   */
  loadToday(date?: string): void {
    if (this.loading()) return;
    this.loading.set(true);

    forkJoin({
      summary: this.getDailySummary(date).pipe(catchError(() => of<DailyNutritionSummaryDto | null>(null))),
      meals: this.getTodayMeals(date).pipe(catchError(() => of<MealLogResponseDto[] | null>(null))),
    }).subscribe(({ summary, meals }) => {
      if (summary) this.summary.set(summary);
      if (meals) this.meals.set(meals);
      this.loading.set(false);
      this.loaded = true;
    });
  }

  /** Loads once per session; safe to call from every component's ngOnInit. */
  ensureLoaded(date?: string): void {
    if (this.loaded || this.loading()) return;
    this.loadToday(date);
  }

  /** Forces a re-fetch of today's summary + meals (e.g. after logging a meal). */
  refreshToday(date?: string): void {
    this.loaded = false;
    this.loadToday(date);
  }

  /** Merges a freshly logged meal into the shared state. */
  applyResult(result: MealAnalysisResultDto): void {
    if (result.dailySummary) this.summary.set(result.dailySummary);
    if (result.loggedMeal) {
      const meal = result.loggedMeal;
      this.meals.update((list) => [meal, ...list]);
    }
  }
}
