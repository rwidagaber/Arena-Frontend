import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-what-we-do',
  standalone: true,
  imports: [TranslateModule, ScrollRevealDirective],
  templateUrl: './what-we-do.component.html',
  styleUrl: './what-we-do.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatWeDoComponent {}
