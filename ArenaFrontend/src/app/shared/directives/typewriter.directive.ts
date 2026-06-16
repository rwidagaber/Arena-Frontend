import { Directive, ElementRef, Input, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTypewriter]',
  standalone: true
})
export class TypewriterDirective implements OnDestroy {
  private _text = '';
  private timeoutId: any;

  @Input() speed = 50; // ms per char
  @Input() delay = 100; // start delay

  @Input('appTypewriter')
  set text(value: string) {
    if (value) {
      this._text = value;
      this.startTyping();
    }
  }

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  private startTyping() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.renderer.setProperty(this.el.nativeElement, 'textContent', '');
    this.timeoutId = setTimeout(() => {
      this.typeChar(0);
    }, this.delay);
  }

  private typeChar(index: number) {
    if (index < this._text.length) {
      this.renderer.setProperty(
        this.el.nativeElement,
        'textContent',
        this._text.substring(0, index + 1)
      );
      this.timeoutId = setTimeout(() => this.typeChar(index + 1), this.speed);
    }
  }

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
}
