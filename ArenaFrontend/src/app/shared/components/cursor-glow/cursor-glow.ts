import { Component, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Site-wide neon-green cursor: a crisp glowing dot that trails the pointer,
 * with a softer ring that lags behind it. Renders on top of everything and
 * never intercepts clicks. Disabled for touch devices and reduced-motion.
 *
 * The pointer loop runs OUTSIDE Angular (NgZone) and writes CSS variables
 * directly, so following the cursor never triggers change detection.
 */
@Component({
  selector: 'app-cursor-glow',
  standalone: true,
  template: `
    <div class="cg-ring" aria-hidden="true"></div>
    <div class="cg-dot" aria-hidden="true"></div>
  `,
  styleUrl: './cursor-glow.css',
})
export class CursorGlowComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private targetX = -100;
  private targetY = -100;
  private x = -100;
  private y = -100;
  private raf = 0;
  private active = false;

  private readonly onMove = (e: MouseEvent): void => {
    this.targetX = e.clientX;
    this.targetY = e.clientY;
    if (!this.active) {
      this.active = true;
      this.x = this.targetX;
      this.y = this.targetY;
      this.host.nativeElement.classList.add('is-active');
    }
  };

  private readonly onLeave = (): void => {
    this.active = false;
    this.host.nativeElement.classList.remove('is-active');
  };

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const noHover = window.matchMedia?.('(hover: none)').matches;
    if (reduce || noHover) return;

    this.zone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onMove, { passive: true });
      document.addEventListener('mouseleave', this.onLeave);

      const el = this.host.nativeElement;
      const loop = (): void => {
        // Ease toward the pointer for a smooth, weighted feel.
        this.x += (this.targetX - this.x) * 0.2;
        this.y += (this.targetY - this.y) * 0.2;
        el.style.setProperty('--cx', `${this.x}px`);
        el.style.setProperty('--cy', `${this.y}px`);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseleave', this.onLeave);
  }
}
