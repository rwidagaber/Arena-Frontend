import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

export type DashboardSection = 'profile' | 'workout' | 'nutrition' | 'bookings' | 'calendar' | 'attendance' | 'chatbot';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.css',
})
export class DashboardSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly activeSection = input<DashboardSection>('profile');
  readonly sectionChange = output<DashboardSection>();

  readonly items: { key: DashboardSection; icon: string; label: string }[] = [
    { key: 'profile',    icon: 'user',         label: 'My Profile' },
    { key: 'workout',    icon: 'dumbbell',     label: 'Workout Plan' },
    { key: 'nutrition',  icon: 'utensils',     label: 'Nutrition Plan' },
    { key: 'bookings',   icon: 'calendar-alt', label: 'Booking' },
    { key: 'calendar',   icon: 'clock',        label: 'Calendar' },
    { key: 'attendance', icon: 'clipboard',    label: 'Attendance' },
    { key: 'chatbot',    icon: 'robot',        label: 'ChatBot' },
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
