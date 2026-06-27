import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/components/footer/footer';
import { FloatingChatButtonComponent } from './shared/components/floating-chat-button/floating-chat-button';
import { DashboardSidebar, DashboardSection } from './components/member-profile/dashboard-sidebar/dashboard-sidebar';
import { CursorGlowComponent } from './shared/components/cursor-glow/cursor-glow';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from '../app/core/services/themeservice';
import { AuthService } from './core/services/auth';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    FloatingChatButtonComponent,
    DashboardSidebar,
    CursorGlowComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private translate = inject(TranslateService);
  private theme = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private auth = inject(AuthService);

  showLayout = true;
  showFooter = true;
  /** True on the dashboard route, where the member-profile renders its OWN
   *  sidebar — so the global one is suppressed there to avoid duplicates. */
  isDashboard = false;

  /** Drives the global subscriber sidebar (shown on every page when subscribed). */
  protected readonly currentUser$ = this.auth.currentUser$;

  ngOnInit(): void {

    const storedLang = localStorage.getItem('arena_lang') || 'en';
    this.translate.use(storedLang);

    document.documentElement.dir = storedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLang;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }

        this.showLayout = !route.snapshot.data['hideLayout'];
        this.showFooter = !route.snapshot.data['hideFooter'];
        this.isDashboard = this.router.url.split('?')[0].startsWith('/dashboard');
      });
  }

  /** Global sidebar item click → open that section on the dashboard. */
  goToSection(section: DashboardSection): void {
    this.router.navigate(['/dashboard'], { queryParams: { section } });
  }
}
