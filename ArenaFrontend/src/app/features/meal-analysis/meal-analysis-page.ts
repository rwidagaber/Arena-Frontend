import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MealAnalysisService } from './services/meal-analysis.service';
import { MealImageAnalysisDto } from '../../core/models/nutrition';
import { TranslationService } from '../../core/services/translation.service';
import { MealLogResponseDto } from './models/meal-analysis.models';

@Component({
  selector: 'app-meal-analysis-page',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './meal-analysis-page.html',
  styleUrl: './meal-analysis-page.css',
})
export class MealAnalysisPage implements OnInit, OnDestroy {
  private service = inject(MealAnalysisService);
  readonly t = inject(TranslationService);

  // ── Shared day state (from the service: stays in sync across the page) ──────
  readonly summary = this.service.summary;
  readonly meals = this.service.meals;
  readonly loading = this.service.loading;

  // ── Scanner state ───────────────────────────────────────────────────────────
  readonly selectedImage = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly analysis = signal<MealImageAnalysisDto | null>(null);
  readonly analyzing = signal(false);
  readonly scanError = signal<string | null>(null);

  // SVG progress ring geometry (r = 52).
  private readonly RING_RADIUS = 52;
  readonly ringCircumference = 2 * Math.PI * this.RING_RADIUS;

  /** Calories eaten today — from the plan summary, or summed from meals as a fallback. */
  readonly consumedCalories = computed(() => {
    const s = this.summary();
    if (s) return s.consumedCalories;
    return this.meals().reduce((sum, m) => sum + (m.calories || 0), 0);
  });

  /** How far through the daily target the member is (0–100, capped). */
  readonly consumedPercent = computed(() => {
    const s = this.summary();
    if (!s || s.dailyCalorieTarget <= 0) return 0;
    const pct = (s.consumedCalories / s.dailyCalorieTarget) * 100;
    return pct > 100 ? 100 : pct;
  });

  readonly ringOffset = computed(
    () => this.ringCircumference * (1 - this.consumedPercent() / 100)
  );

  ngOnInit(): void {
    this.service.ensureLoaded();
  }

  ngOnDestroy(): void {
    const p = this.preview();
    if (p) URL.revokeObjectURL(p);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.analysis.set(null);
    this.scanError.set(null);

    const old = this.preview();
    if (old) URL.revokeObjectURL(old);

    if (!file) {
      this.preview.set(null);
      this.selectedImage.set(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.preview.set(null);
      this.selectedImage.set(null);
      this.scanError.set(this.t.translate('mealAnalysis.invalidImage'));
      return;
    }

    this.selectedImage.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  analyze(): void {
    const file = this.selectedImage();
    if (!file || this.analyzing()) return;

    this.analyzing.set(true);
    this.scanError.set(null);

    this.service.analyzeMealImage(file).subscribe({
      next: (result) => {
        this.analysis.set(result.analysis);
        this.service.applyResult(result);
        // The meal was logged against the plan; if the backend didn't echo a fresh
        // day summary, refetch so remaining-calories reflects the subtracted meal.
        if (!result.dailySummary) {
          this.service.refreshToday();
        }
        this.analyzing.set(false);
      },
      error: (err) => {
        const message =
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : null) ||
          err?.message ||
          this.t.translate('mealAnalysis.analyzeError');
        this.scanError.set(message);
        this.analyzing.set(false);
      },
    });
  }

  clear(input?: HTMLInputElement): void {
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);

    this.selectedImage.set(null);
    this.preview.set(null);
    this.analysis.set(null);
    this.scanError.set(null);

    if (input) input.value = '';
  }

  trackMeal(_: number, meal: MealLogResponseDto): string {
    return meal.id;
  }
}
