import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HeaderComponent } from './shared/header/header';
import { HeroComponent } from './features/hero/hero.component';
import { ProgramsComponent } from './features/programs/programs.component';
import { WhatWeDoComponent } from './features/what-we-do/what-we-do.component';
import { WhyChooseUsComponent } from './features/why-choose-us/why-choose-us.component';
import { PricingComponent } from './features/pricing/pricing.component';
import { FooterComponent } from './shared/components/footer/footer';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    HeroComponent,
    ProgramsComponent,
    WhatWeDoComponent,
    WhyChooseUsComponent,
    PricingComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private router = inject(Router);
  private translate = inject(TranslateService);
  private routerSub?: Subscription;
  protected readonly title = signal('ArenaFrontend');
  protected readonly isHomePage = signal(false);

  ngOnInit(): void {
    this.initLanguage();
    this.syncUrl();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.syncUrl());
  }

  private initLanguage(): void {
    const storedLang = localStorage.getItem('arena_lang') || 'en';
    this.translate.use(storedLang);
    document.documentElement.dir = storedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLang;
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private syncUrl(): void {
    const path = this.router.url.split('?')[0];
    this.isHomePage.set(path === '/' || path === '');
  }
}

