import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WorkoutSession } from '../../../core/models/member';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-recent-workouts',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './recent-workouts.html',
  styleUrl: './recent-workouts.css',
})
export class RecentWorkouts {
  workouts = input<WorkoutSession[]>([]);
  loading = input<boolean>(false);

  private sanitizer = inject(DomSanitizer);

  private readonly svgIcons: Record<string, string> = {
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="3" height="8"/><rect x="19" y="8" width="3" height="8"/><rect x="5" y="6" width="14" height="12" rx="1"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="5" y1="14" x2="19" y2="14"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-3.866 0-7-3.134-7-7 0-3.866 3.134-7 7-7s7 3.134 7 7c0 3.866-3.134 7-7 7z"/></svg>',
    'heart-pulse': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    'person-walking': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><path d="M9 20l3-6 3 6"/><path d="M5 12h4l3-3 3 3h4"/><path d="M12 8v2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'person-running': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1"/><path d="M10 20l2-5 3-2 3 7"/><path d="M6 12l4-2 2-4 4 1"/><path d="M13 11l2-4"/></svg>',
  };

  getSvgIcon(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.svgIcons[name] || '');
  }

  getTypeIcon(type: string): string {
    const t = type?.toLowerCase() || '';
    if (t.includes('cardio')) return 'heart-pulse';
    if (t.includes('strength')) return 'dumbbell';
    if (t.includes('flexibility') || t.includes('yoga') || t.includes('stretch')) return 'person-walking';
    if (t.includes('hiit') || t.includes('interval')) return 'bolt';
    if (t.includes('leg') || t.includes('lower')) return 'person-running';
    return 'dumbbell';
  }
}
