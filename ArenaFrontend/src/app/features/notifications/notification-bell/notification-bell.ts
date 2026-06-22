import { Component, inject, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
  styleUrls: ['./notification-bell.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  readonly svc = inject(NotificationService);
  readonly open = signal(false);

  // IDs of notifications currently expanded (showing full message).
  private readonly expandedIds = signal<Set<string>>(new Set());

  ngOnInit() {
    this.svc.loadNotifications();
    this.svc.connectHub();
  }

  ngOnDestroy() {
    this.svc.disconnectHub();
  }

  // ✅ الحل — toggle على الـ button مباشرة
  toggle(e: Event) {
    e.stopPropagation();
    this.open.update(v => !v);
  }

  // ✅ الحل — اقفل بس لو الـ click برا الـ bell-wrapper
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.bell-wrapper')) {
      this.open.set(false);
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  /** Click on the title row: toggles the full message open/closed,
   *  and marks the notification as read (color change) the first time. */
  toggleNotif(n: NotificationDto): void {
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(n.id) ? next.delete(n.id) : next.add(n.id);
      return next;
    });

    if (!n.isRead) {
      this.svc.markAsRead(n.id);
    }
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
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
}