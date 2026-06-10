import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export type DashboardSection = 'profile' | 'workout' | 'nutrition' | 'bookings' | 'calendar' | 'attendance' | 'chatbot';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.css',
})
export class DashboardSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly activeSection = input<DashboardSection>('profile');
  readonly sectionChange = output<DashboardSection>();

  readonly items: { key: DashboardSection; icon: string; label: string }[] = [
    { key: 'profile',    icon: 'user',         label: 'sidebar.profile' },
    { key: 'workout',    icon: 'dumbbell',     label: 'sidebar.workout' },
    { key: 'nutrition',  icon: 'utensils',     label: 'sidebar.nutrition' },
    { key: 'bookings',   icon: 'calendar-alt', label: 'sidebar.bookings' },
    { key: 'calendar',   icon: 'clock',        label: 'sidebar.calendar' },
    { key: 'attendance', icon: 'clipboard',    label: 'sidebar.attendance' },
    { key: 'chatbot',    icon: 'robot',        label: 'sidebar.chatbot' },
  ];

  select(section: DashboardSection): void {
    this.sectionChange.emit(section);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
  }
}
