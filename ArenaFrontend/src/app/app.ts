import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { HeroComponent } from './features/hero/hero.component';
import { ProgramsComponent } from './features/programs/programs.component';
import { WhatWeDoComponent } from './features/what-we-do/what-we-do.component';
import { WhyChooseUsComponent } from './features/why-choose-us/why-choose-us.component';
import { FooterComponent } from './shared/components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    HeroComponent,
    ProgramsComponent,
    WhatWeDoComponent,
    WhyChooseUsComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private router = inject(Router);
  protected readonly title = signal('ArenaFrontend');

  get isHomePage(): boolean {
    const url = this.router.url;
    return url === '/' || url === '';
  }
}

