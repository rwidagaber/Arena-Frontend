import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [TranslateModule],
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

  greetingKey(): string {
    const h = new Date().getHours();
    if (h < 12) return 'memberProfile.greeting.morning';
    if (h < 17) return 'memberProfile.greeting.afternoon';
    return 'memberProfile.greeting.evening';
  }
}
