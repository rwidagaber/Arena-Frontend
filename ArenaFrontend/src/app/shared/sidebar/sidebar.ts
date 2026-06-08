import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../pipes/translate.pipe';

export type SidebarSection = 'profile' | 'workout' | 'nutrition' | 'bookings' | 'calendar' | 'attendance';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  readonly activeSection = input<SidebarSection>('profile');
  readonly sectionChange = output<SidebarSection>();

  readonly items: { key: SidebarSection; icon: string; label: string }[] = [
    { key: 'profile',   icon: 'person',       label: 'sidebar.profile' },
    { key: 'workout',   icon: 'fitness',      label: 'sidebar.workout' },
    { key: 'nutrition', icon: 'restaurant',   label: 'sidebar.nutrition' },
    { key: 'bookings',  icon: 'calendar',     label: 'sidebar.bookings' },
    { key: 'calendar',  icon: 'schedule',     label: 'sidebar.calendar' },
    { key: 'attendance', icon: 'check-circle', label: 'sidebar.attendance' },
  ];

  select(section: SidebarSection): void {
    this.sectionChange.emit(section);
  }

  getIcon(name: string): string {
    const icons: Record<string, string> = {
      person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      fitness: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5 17.5 17.5M6.5 17.5 17.5 6.5"/><line x1="6" y1="12" x2="18" y2="12"/></svg>',
      restaurant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    };
    return icons[name] || '';
  }
}
