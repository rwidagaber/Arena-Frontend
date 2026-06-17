import { Directive, ElementRef, Input, OnInit, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appScrollReveal]',
  standalone: true
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  @Input() revealDelay = 0; // delay in ms
  @Input() revealDuration = 800; // duration in ms
  @Input() revealClass = 'reveal-fade-up';

  private observer?: IntersectionObserver;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    this.renderer.addClass(this.el.nativeElement, this.revealClass);
    
    if (this.revealDuration !== 800) {
      this.renderer.setStyle(this.el.nativeElement, 'transition-duration', `${this.revealDuration}ms`);
    }

    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
        }, this.revealDelay);
        this.observer?.disconnect();
      }
    }, { threshold: 0.1 });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
