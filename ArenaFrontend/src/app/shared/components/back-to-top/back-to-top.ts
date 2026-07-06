import { Component, HostListener } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-back-to-top',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <button
      type="button"
      class="back-to-top"
      [class.visible]="showTopButton"
      (click)="scrollToTop()"
      [attr.aria-label]="'footer.backToTop' | translate"
    >
      <i class="bi bi-arrow-up"></i>
    </button>
  `,
  styles: [`
    :host {
      display: contents;
      --fb-accent: #C6EF2E;
    }
    :host-context([data-theme="light"]) {
      --fb-accent: #C6EF2E;
    }

    .back-to-top {
      position: fixed;
      bottom: 24px;
      inset-inline-end: 28px;
      width: 46px; height: 46px;
      border-radius: 50%;
      border: none;
      background: var(--fb-accent);
      color: #0c0f17;
      font-size: 1.1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 1050;
      opacity: 0;
      transform: translateY(20px) scale(0.85);
      pointer-events: none;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--fb-accent) 35%, transparent);
      transition: opacity 0.3s ease, transform 0.3s ease, background 0.2s ease;
    }
    .back-to-top.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .back-to-top:hover {
      background: #beee16;
      transform: translateY(-3px) scale(1.05);
    }
    .back-to-top i { position: relative; z-index: 1; }
  `]
})
export class BackToTopComponent {
  showTopButton = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.showTopButton = window.scrollY > 400;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
