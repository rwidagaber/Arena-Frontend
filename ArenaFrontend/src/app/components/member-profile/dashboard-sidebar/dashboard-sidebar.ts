import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { TranslateModule } from '@ngx-translate/core';

export type DashboardSection = 'profile' | 'qr' | 'workout' | 'diet' | 'membership' | 'progress' | 'settings';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './dashboard-sidebar.html',
  styleUrl: './dashboard-sidebar.css',
})
export class DashboardSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly activeSection = input<DashboardSection>('profile');
  readonly sectionChange = output<DashboardSection>();
  readonly renewPlan = output<void>();

  readonly planName = input<string | null>(null);
  readonly planLevel = input<string>('');
  readonly expiryDate = input<string | null>(null);
  readonly membershipProgress = input<number>(0);
  readonly remainingSessions = input<number | null>(null);
  readonly daysRemaining = input<number>(0);
  readonly hasSubscription = input<boolean>(false);
  readonly profileImage = input<string | null>(null);
  readonly firstName = input<string>('');
  readonly lastName = input<string>('');

  readonly items: { key: DashboardSection; icon: string; label: string }[] = [
    { key: 'profile',    icon: 'grid',       label: 'sidebar.dashboard' },
    { key: 'qr',         icon: 'qr',         label: 'sidebar.qrCodes' },
    { key: 'workout',    icon: 'dumbbell',   label: 'sidebar.myWorkouts' },
    { key: 'diet',       icon: 'utensils',   label: 'sidebar.myDietPlan' },
    { key: 'membership', icon: 'shield',     label: 'sidebar.membershipBilling' },
    { key: 'progress',   icon: 'chart',      label: 'sidebar.progressReport' },
    { key: 'settings',   icon: 'settings',   label: 'sidebar.settings' },
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
