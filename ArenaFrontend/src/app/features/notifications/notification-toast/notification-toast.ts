import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NotificationService, NotificationDto } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './notification-toast.html',
  styleUrls: ['./notification-toast.css']
})
export class NotificationToastComponent {
  readonly svc = inject(NotificationService);
  readonly t = inject(TranslateService);

  /** Translated aria-label for the dismiss button. */
  get dismissLabel(): string {
    return this.t.instant('notifications.dismiss');
  }

  open(n: NotificationDto): void {
    if (!n.isRead) this.svc.markAsRead(n.id);
    this.svc.dismissToast(n.id);
  }

  dismiss(n: NotificationDto, event: Event): void {
    event.stopPropagation();
    this.svc.dismissToast(n.id);
  }

  pause(n: NotificationDto): void {
    this.svc.pauseToast(n.id);
  }

  resume(n: NotificationDto): void {
    this.svc.resumeToast(n.id);
  }
}