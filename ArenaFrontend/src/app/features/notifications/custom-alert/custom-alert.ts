import { Component, HostListener, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-custom-alert',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './custom-alert.html',
  styleUrls: ['./custom-alert.css']
})
export class CustomAlertComponent {
  readonly svc = inject(NotificationService);
  readonly alert = this.svc.activeAlert;

  constructor() {
    effect(() => {
      const active = this.alert();
      if (active) {
        setTimeout(() => {
          const ctaBtn = document.querySelector('.alert-cta') as HTMLElement;
          if (ctaBtn) {
            ctaBtn.focus();
          } else {
            const closeBtn = document.querySelector('.alert-close') as HTMLElement;
            if (closeBtn) closeBtn.focus();
          }
        }, 80);
      }
    });
  }

  confirm(): void {
    const active = this.alert();
    if (active) {
      active.resolve(true);
    }
  }

  dismiss(): void {
    const active = this.alert();
    if (active) {
      active.resolve(false);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any): void {
    if (this.alert()) {
      this.dismiss();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: any): void {
    const active = this.alert();
    if (!active) return;

    if (event.key === 'Tab') {
      const modalEl = document.querySelector('.alert-modal');
      if (!modalEl) return;
      
      const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([-1])';
      const focusables = Array.from(modalEl.querySelectorAll(focusableSelectors)) as HTMLElement[];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    }
  }
}
