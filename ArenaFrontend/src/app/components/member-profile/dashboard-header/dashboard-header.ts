import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  templateUrl: './dashboard-header.html',
  styleUrl: './dashboard-header.css',
})
export class DashboardHeader {
  firstName = input<string>('');
  lastName = input<string>('');
  profileImage = input<string | null>(null);
  memberSince = input<string>('');
  isActive = input<boolean>(false);
  loading = input<boolean>(false);
  motivationalMessage = input<string>('Push harder than yesterday.');

  timeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}
