import {
  Component, OnInit, inject, signal, computed,
  ChangeDetectionStrategy, input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout';
import type { WorkoutPlanDto, WorkoutDayDto, WorkoutExerciseDto } from '../../../core/models/workout';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../../core/services/themeservice';

@Component({
  selector: 'app-workout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, TranslateModule],
  templateUrl: './workout.html',
  styleUrl: './workout.css',
})
export class WorkoutComponent implements OnInit {

  readonly t         = inject(TranslateService);
  private workoutSvc = inject(WorkoutService);
  private themeSvc   = inject(ThemeService);

  memberProfileId = input<string>('');

  isDarkMode = computed(() => this.themeSvc.isDark);

  // ── View state ────────────────────────────────────────────────────────────────
  view             = signal<'plans' | 'plan-detail' | 'exercise-detail'>('plans');
  plans            = signal<WorkoutPlanDto[]>([]);
  selectedPlan     = signal<WorkoutPlanDto | null>(null);
  selectedDayId    = signal<string | null>(null);
  selectedExercise = signal<WorkoutExerciseDto | null>(null);
  loading          = signal(true);
  error            = signal<string | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────────
  searchQuery    = signal('');
  showActiveOnly = signal(false);

  filteredPlans = computed<WorkoutPlanDto[]>(() => {
    const q      = this.searchQuery().toLowerCase().trim();
    const active = this.showActiveOnly();
    return this.plans().filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      const matchActive = !active || p.isActive;
      return matchSearch && matchActive;
    });
  });

  // 🌟 تعديل: تغيير البحث ليعتمد على days بدلاً من workoutDays
  selectedDay = computed<WorkoutDayDto | null>(() => {
    const plan = this.selectedPlan();
    const id   = this.selectedDayId();
    if (!plan) return null;
    return plan.days?.find(d => d.id === id) ?? plan.days?.[0] ?? null;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.workoutSvc.getMyWorkoutPlans().pipe(
      catchError(() => {
        this.error.set(this.t.instant('workout.loadError'));
        return of([]);
      })
    ).subscribe(plans => {
      this.plans.set(plans);
      this.loading.set(false);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  openPlan(plan: WorkoutPlanDto): void {
    this.loading.set(true);
    this.workoutSvc.getWorkoutPlanById(plan.id).pipe(
      catchError(() => {
        this.error.set(this.t.instant('workout.loadError'));
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(fullPlan => {
      if (!fullPlan) return;
      this.selectedPlan.set(fullPlan);
      // 🌟 تعديل هنا أيضاً لقراءة الأيام بالشكل الجديد days
      this.selectedDayId.set(fullPlan.days?.[0]?.id ?? null);
      this.view.set('plan-detail');
      this.loading.set(false);
    });
  }

  openExercise(ex: WorkoutExerciseDto): void {
    this.selectedExercise.set(ex);
    this.view.set('exercise-detail');
  }

  goBack(): void {
    if (this.view() === 'plan-detail') {
      this.selectedPlan.set(null);
      this.view.set('plans');
    } else if (this.view() === 'exercise-detail') {
      this.selectedExercise.set(null);
      this.view.set('plan-detail');
    }
  }

  selectDay(dayId: string): void { this.selectedDayId.set(dayId); }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  getPlanImage(plan: WorkoutPlanDto): string {
    const name = plan.name?.toLowerCase() || '';
    if (name.includes('cardio') || name.includes('cut') || name.includes('تنشيف')) return 'assets/images/scale.jpg';
    if (name.includes('bulk') || name.includes('strength') || name.includes('تضخيم')) return 'assets/images/dumble.jpg';
    return 'assets/images/mat.jpg';
  }

  // 🌟 تعديل هنا لاستخدام التجميع بناءً على الـ days الجديدة القادمة من الباك
  getTotalExercises(plan: WorkoutPlanDto): number {
    return plan.days?.reduce((s, d) => s + (d.exercises?.length ?? 0), 0) ?? 0;
  }

  getEstimatedKcal(plan: WorkoutPlanDto): number {
    return this.getTotalExercises(plan) * 50;
  }

  muscleGroupIcon(group: string): string {
    const g = (group ?? '').toLowerCase();
    if (g.includes('chest'))    return '🫁';
    if (g.includes('back'))     return '🔙';
    if (g.includes('leg') || g.includes('quad') || g.includes('hamstring')) return '🦵';
    if (g.includes('shoulder')) return '🦾';
    if (g.includes('arm') || g.includes('bicep') || g.includes('tricep'))   return '💪';
    if (g.includes('core') || g.includes('ab'))   return '🎯';
    if (g.includes('cardio'))   return '❤️';
    if (g.includes('glute'))    return '🍑';
    return '🏋️';
  }

  translateMuscleGroup(group: string): string {
    const g = (group ?? '').toLowerCase();
    const key = (() => {
      if (g.includes('chest'))    return 'workout.muscleGroups.chest';
      if (g.includes('back'))     return 'workout.muscleGroups.back';
      if (g.includes('shoulder')) return 'workout.muscleGroups.shoulders';
      if (g.includes('bicep'))    return 'workout.muscleGroups.biceps';
      if (g.includes('tricep'))   return 'workout.muscleGroups.triceps';
      if (g.includes('leg'))      return 'workout.muscleGroups.legs';
      if (g.includes('quad'))     return 'workout.muscleGroups.quadriceps';
      if (g.includes('hamstring'))return 'workout.muscleGroups.hamstrings';
      if (g.includes('glute'))    return 'workout.muscleGroups.glutes';
      if (g.includes('calve'))    return 'workout.muscleGroups.calves';
      if (g.includes('abs'))      return 'workout.muscleGroups.abs';
      if (g.includes('core'))     return 'workout.muscleGroups.core';
      if (g.includes('forearm'))  return 'workout.muscleGroups.forearms';
      if (g.includes('full'))     return 'workout.muscleGroups.fullBody';
      if (g.includes('cardio'))   return 'workout.muscleGroups.cardio';
      return null;
    })();
    return key ? this.t.instant(key) : group;
  }

  getMuscleGroupColor(group: string): string {
    const g = (group ?? '').toLowerCase();
    if (g.includes('chest'))    return 'mg-chest';
    if (g.includes('back'))     return 'mg-back';
    if (g.includes('leg') || g.includes('quad') || g.includes('hamstring')) return 'mg-legs';
    if (g.includes('shoulder')) return 'mg-shoulder';
    if (g.includes('arm') || g.includes('bicep') || g.includes('tricep'))   return 'mg-arms';
    if (g.includes('core') || g.includes('ab'))   return 'mg-core';
    if (g.includes('cardio'))   return 'mg-cardio';
    return 'mg-default';
  }

  trackByPlan(_: number, p: WorkoutPlanDto)         { return p.id; }
  trackByDay(_: number, d: WorkoutDayDto)           { return d.id; }
  trackByExercise(_: number, e: WorkoutExerciseDto) { return e.id; }
}