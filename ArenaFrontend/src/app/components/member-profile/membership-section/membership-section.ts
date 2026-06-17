import { Component, input, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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

  // Pagination state
  currentPage = signal<number>(1);
  pageSize = signal<number>(8);

  activeSubscription = computed(() => {
    const subs = this.subscriptions();
    if (!subs) return null;
    return subs.find(s => s.status.toLowerCase() === 'active') || null;
  });

  historySubscriptions = computed(() => {
    const subs = this.subscriptions();
    if (!subs) return [];
    return subs
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  });

  totalPages = computed(() => {
    return Math.ceil(this.historySubscriptions().length / this.pageSize());
  });

  pageRange = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  paginatedHistorySubscriptions = computed(() => {
    const history = this.historySubscriptions();
    const page = this.currentPage();
    const total = this.totalPages();
    const validPage = Math.max(1, Math.min(page, total || 1));
    const startIndex = (validPage - 1) * this.pageSize();
    return history.slice(startIndex, startIndex + this.pageSize());
  });

  constructor() {
    // Dynamic page size based on screen width
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(max-width: 1023px)');
      this.pageSize.set(mediaQuery.matches ? 6 : 8);

      mediaQuery.addEventListener('change', (e) => {
        this.pageSize.set(e.matches ? 6 : 8);
      });
    }

    effect(() => {
      this.subscriptions();
      this.currentPage.set(1);
    }, { allowSignalWrites: true });
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getPlanName(sub: UserSubscriptionDto): string {
    const lang = this.translate.currentLang || 'en';
    return lang.startsWith('ar') ? sub.planNameAr : sub.planNameEn;
  }

  getStatusKey(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':    return 'memberProfile.status.active';
      case 'pending':   return 'memberProfile.status.pending';
      case 'expired':   return 'memberProfile.status.expired';
      case 'cancelled': return 'memberProfile.status.cancelled';
      default:          return 'memberProfile.status.unknown';
    }
  }

  private sanitizer = inject(DomSanitizer);

  private readonly svgIcons: Record<string, string> = {
    'id-card': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 12h3"/><path d="M15 16h3"/><path d="M5 16h4"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="3" height="8"/><rect x="19" y="8" width="3" height="8"/><rect x="5" y="6" width="14" height="12" rx="1"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="5" y1="14" x2="19" y2="14"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
  };

  getSvgIcon(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.svgIcons[name] || '');
  }
}
