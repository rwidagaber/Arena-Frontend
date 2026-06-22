import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toast.html',
  styleUrls: ['./notification-toast.css']
})
export class NotificationToastComponent {
  readonly svc = inject(NotificationService);

  /** Clicking the body opens it as read (same as opening it from the bell list). */
  open(n: NotificationDto): void {
    if (!n.isRead) {
      this.svc.markAsRead(n.id);
    }
    this.svc.dismissToast(n.id);
  }

  /** The explicit × button just dismisses, without forcing a read state. */
  dismiss(n: NotificationDto, event: Event): void {
    event.stopPropagation();
    this.svc.dismissToast(n.id);
  }

  dotClass(type: string) {
    return {
      'dot-success': type === 'Success',
      'dot-warning': type === 'Warning',
      'dot-error':   type === 'Error',
      'dot-info':    type === 'Info',
    };
  }
}