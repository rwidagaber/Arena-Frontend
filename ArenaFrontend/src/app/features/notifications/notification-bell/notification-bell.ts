import { Component, inject, OnInit, OnDestroy, HostListener, signal, computed, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './notification-bell.html',
  styleUrls: ['./notification-bell.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  readonly svc    = inject(NotificationService);
  readonly t      = inject(TranslateService);
  readonly elRef  = inject(ElementRef);
  readonly open   = signal(false);
  readonly panelTop = signal('64px');

  private readonly expandedIds = signal<Set<string>>(new Set());
  readonly activeFilter = signal<'all' | 'unread'>('all');

  private isToday(dateStr: string): boolean {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth()    === now.getMonth()
        && d.getDate()     === now.getDate();
  }

  readonly filteredNotifications = computed(() => {
    const todayList = this.svc.notifications().filter(n => this.isToday(n.createdAt));
    return this.activeFilter() === 'unread'
      ? todayList.filter(n => !n.isRead)
      : todayList;
  });

  ngOnInit() {
    this.svc.loadNotifications();
    this.svc.connectHub();
  }

  ngOnDestroy() {
    this.svc.disconnectHub();
  }

  toggle(e: Event) {
    e.stopPropagation();
    this.open.update(v => !v);

    if (!this.open()) return;

    const header = document.querySelector('header')
                ?? document.querySelector('.header')
                ?? document.querySelector('nav');
    if (header) {
      const h = header.getBoundingClientRect().bottom;
      this.panelTop.set(h + 'px');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.bell-wrapper')) {
      this.open.set(false);
    }
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.activeFilter.set(filter);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleNotif(n: NotificationDto): void {
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(n.id) ? next.delete(n.id) : next.add(n.id);
      return next;
    });
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

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);

    if (m < 1)  return this.t.instant('notifications.justNow');
    if (m < 60) return this.t.instant('notifications.minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return this.t.instant('notifications.hoursAgo', { count: h });
    return       this.t.instant('notifications.daysAgo', { count: Math.floor(h / 24) });
  }
}