import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { HeroComponent } from './features/hero/hero.component';
import { ProgramsComponent } from './features/programs/programs.component';
import { WhatWeDoComponent } from './features/what-we-do/what-we-do.component';
import { WhyChooseUsComponent } from './features/why-choose-us/why-choose-us.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ArenaFrontend');
}