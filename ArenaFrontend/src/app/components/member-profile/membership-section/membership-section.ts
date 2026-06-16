import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserSubscriptionDto } from '../../../core/models/auth';

@Component({
  selector: 'app-membership-section',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './membership-section.html',
  styleUrl: './membership-section.css',
})
export class MembershipSection {
  private translate = inject(TranslateService);

  subscriptions = input<UserSubscriptionDto[]>([]);
  loading = input<boolean>(false);

  activeSubscription = computed(() => {
    const subs = this.subscriptions();
    if (!subs) return null;
    return subs.find(s => s.status.toLowerCase() === 'active') || null;
  });

  historySubscriptions = computed(() => {
    const subs = this.subscriptions();
    if (!subs) return [];
    return subs.filter(s => s.status.toLowerCase() !== 'active').sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  });

  getPlanName(sub: UserSubscriptionDto): string {
    const lang = this.translate.currentLang || 'en';
    return lang.startsWith('ar') ? sub.planNameAr : sub.planNameEn;
  }
}
