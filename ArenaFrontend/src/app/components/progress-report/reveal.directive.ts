import { Directive, ElementRef, inject, AfterViewInit, OnDestroy, Input } from '@angular/core';

/**
 * Scroll-reveal: the element starts hidden (offset + faded) and animates in
 * with an easeOut-expo curve the first time it enters the viewport.
 * Usage: <div appReveal> ... </div>  (optional [revealDelay]="120" in ms)
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  /** Optional stagger delay (ms) applied to the transition. */
  @Input() revealDelay = 0;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    if (this.revealDelay) {
      node.style.transitionDelay = `${this.revealDelay}ms`;
    }

    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('reveal-in');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('reveal-in');
            obs.unobserve(entry.target);
          }
        }
      },
      // threshold:0 so the reveal triggers as soon as any part of the element
      // enters the viewport — a percentage threshold never fires for elements
      // taller than ~8× the viewport (e.g. the stacked cards on small screens).
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
