import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';
import { NutritionService } from '../../../core/services/nutrition';
import { DailyNutritionSummaryDto } from '../../../core/models/nutrition';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-daily-nutrition-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './daily-nutrition-summary.html',
  styleUrl: './daily-nutrition-summary.css',
})
export class DailyNutritionSummary implements OnInit {
  private nutritionService = inject(NutritionService);
  readonly t = inject(TranslationService);

  summary = signal<DailyNutritionSummaryDto | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.nutritionService.getDailySummary().pipe(
      catchError(() => of(null))
    ).subscribe(summary => {
      this.summary.set(summary);
      this.loading.set(false);
    });
  }

  consumedPercent(s: DailyNutritionSummaryDto): number {
    if (s.dailyCalorieTarget <= 0) return 0;
    const pct = (s.consumedCalories / s.dailyCalorieTarget) * 100;
    return pct > 100 ? 100 : pct;
  }
}
