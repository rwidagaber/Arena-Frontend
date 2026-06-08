import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-what-we-do',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './what-we-do.component.html',
  styleUrl: './what-we-do.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatWeDoComponent {}
