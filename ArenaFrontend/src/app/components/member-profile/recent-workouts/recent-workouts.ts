import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutSession } from '../../../core/models/member';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-recent-workouts',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './recent-workouts.html',
  styleUrl: './recent-workouts.css',
})
export class RecentWorkouts {
  workouts = input<WorkoutSession[]>([]);
  loading = input<boolean>(false);

  getTypeIcon(type: string): string {
    const t = type?.toLowerCase() || '';
    if (t.includes('cardio')) return 'fas fa-heart-pulse';
    if (t.includes('strength')) return 'fas fa-dumbbell';
    if (t.includes('flexibility') || t.includes('yoga') || t.includes('stretch')) return 'fas fa-person-walking';
    if (t.includes('hiit') || t.includes('interval')) return 'fas fa-bolt';
    if (t.includes('leg') || t.includes('lower')) return 'fas fa-person-running';
    return 'fas fa-dumbbell';
  }
}
