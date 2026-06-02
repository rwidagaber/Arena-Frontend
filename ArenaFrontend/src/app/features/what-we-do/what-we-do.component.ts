import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-what-we-do',
  standalone: true,
  imports: [],
  templateUrl: './what-we-do.component.html',
  styleUrl: './what-we-do.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatWeDoComponent {}
