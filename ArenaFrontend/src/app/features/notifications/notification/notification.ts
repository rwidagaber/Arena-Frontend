import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

type DateGroup = 'today' | 'week' | 'earlier';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './notification.html',
  styleUrl: './notification.css',
})
export class Notification implements OnInit, OnDestroy {
  readonly svc    = inject(NotificationService);
  readonly t      = inject(TranslateService);

  readonly activeTab    = signal<DateGroup>('today');
  readonly visibleCount = signal(PAGE_SIZE);

  private readonly grouped = computed(() => {
    const groups: Record<DateGroup, NotificationDto[]> = { today: [], week: [], earlier: [] };
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    for (const n of this.svc.notifications()) {
      const diff = now - new Date(n.createdAt).getTime();
      if (diff < DAY)          groups.today.push(n);
      else if (diff < DAY * 7) groups.week.push(n);
      else                     groups.earlier.push(n);
    }
    return groups;
  });

  readonly activeList  = computed(() => this.grouped()[this.activeTab()]);
  readonly visibleList = computed(() => this.activeList().slice(0, this.visibleCount()));
  readonly hasMore     = computed(() => this.activeList().length > this.visibleCount());

  ngOnInit(): void {
    this.svc.loadNotifications();
    this.svc.connectHub();
  }

  ngOnDestroy(): void {
    this.svc.disconnectHub();
  }

  setTab(tab: DateGroup): void {
    this.activeTab.set(tab);
    this.visibleCount.set(PAGE_SIZE);
  }

  loadMore(): void {
    this.visibleCount.update(c => c + PAGE_SIZE);
  }

  markRead(n: NotificationDto): void {
    if (!n.isRead) this.svc.markAsRead(n.id);
  }

  dotClass(type: string) {
    return {
      'dot-success': type === 'Success',
      'dot-warning': type === 'Warning',
      'dot-error':   type === 'Error',
      'dot-info':    type === 'Info',
    };
  }

  iconFor(type: string): 'bulb' | 'chart' | 'wrench' | 'bell' {
    switch (type) {
      case 'Success': return 'bulb';
      case 'Info':    return 'chart';
      case 'Warning': return 'wrench';
      default:        return 'bell';
    }
  }

  /**
   * Returns a translated relative-time string.
   * Uses instant() so it works inside a synchronous template helper.
   * The `translate` pipe handles reactivity for static labels;
   * timeAgo() is called per-item and re-evaluated on change detection.
   */
  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);

    if (m < 1)  return this.t.instant('notifications.justNow');
    if (m < 60) return this.t.instant('notifications.minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return this.t.instant('notifications.hoursAgo', { count: h });
    return       this.t.instant('notifications.daysAgo',    { count: Math.floor(h / 24) });
  }
}