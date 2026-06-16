import { Directive, ElementRef, Input, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective implements OnDestroy {
  private _target = '';
  private observer?: IntersectionObserver;
  private animationStarted = false;

  @Input() duration = 1500; // duration in ms

  @Input('appCountUp')
  set target(value: string) {
    if (value && value !== this._target) {
      this._target = value;
      this.animationStarted = false;
      this.initObserver();
    }
  }

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  private initObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    const numberPart = this._target.match(/\d+/);
    if (numberPart) {
      const suffix = this._target.replace(numberPart[0], '');
      this.renderer.setProperty(this.el.nativeElement, 'textContent', `0${suffix}`);
    } else {
      this.renderer.setProperty(this.el.nativeElement, 'textContent', this._target);
    }

    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.animationStarted) {
        this.animationStarted = true;
        this.startCounting();
        this.observer?.disconnect();
      }
    }, { threshold: 0.1 });

    this.observer.observe(this.el.nativeElement);
  }

  private startCounting() {
    const numberPart = this._target.match(/\d+/);
    if (!numberPart) {
      this.renderer.setProperty(this.el.nativeElement, 'textContent', this._target);
      return;
    }

    const targetNumber = parseInt(numberPart[0], 10);
    const suffix = this._target.replace(numberPart[0], '');

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      
      // Easing out quadratic
      const easeProgress = progress * (2 - progress);
      const currentValue = Math.floor(easeProgress * targetNumber);

      this.renderer.setProperty(
        this.el.nativeElement,
        'textContent',
        `${currentValue}${suffix}`
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.renderer.setProperty(
          this.el.nativeElement,
          'textContent',
          this._target
        );
      }
    };

    requestAnimationFrame(animate);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
