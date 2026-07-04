import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RoutesRecognized, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/components/footer/footer';
import { FloatingChatButtonComponent } from './shared/components/floating-chat-button/floating-chat-button';
import { BackToTopComponent } from './shared/components/back-to-top/back-to-top';
import { DashboardSidebar, DashboardSection } from './components/member-profile/dashboard-sidebar/dashboard-sidebar';
import { CursorGlowComponent } from './shared/components/cursor-glow/cursor-glow';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from '../app/core/services/themeservice';
import { AuthService } from './core/services/auth';
import { CustomAlertComponent } from './features/notifications/custom-alert/custom-alert';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    FloatingChatButtonComponent,
    BackToTopComponent,
    DashboardSidebar,
    CursorGlowComponent,
    CustomAlertComponent,
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

  showLayout = false;
  showFooter = false;
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

    // ✅ بنمسك RoutesRecognized (بيطلق بدري جدًا فور ما الراوتر يحدد الـ route،
    // قبل الـ Guards وقبل تحميل الـ lazy chunk) بالإضافة لـ NavigationEnd
    // عشان نحدد إظهار/إخفاء الـ Header والـ Footer بأسرع وقت ممكن ونمنع
    // ومضة ظهورهم الافتراضي قبل ما الصفحة تستقر.
    this.router.events
      .pipe(
        filter(event =>
          event instanceof RoutesRecognized || event instanceof NavigationEnd
        )
      )
      .subscribe(event => {

        // RoutesRecognized بيوصل الـ state الجديد جوه الـ event نفسه
        // (router.routerState.snapshot لسه مش متحدث في اللحظة دي).
        // أما NavigationEnd فالـ router.routerState.snapshot بيبقى محدث فعلاً.
        const rootSnapshot = event instanceof RoutesRecognized
          ? event.state.root
          : this.router.routerState.snapshot.root;

        let deepest = rootSnapshot;
        while (deepest.firstChild) {
          deepest = deepest.firstChild;
        }

        this.showLayout = !deepest.data['hideLayout'];
        this.showFooter = !deepest.data['hideFooter'];
        this.isDashboard = this.router.url.split('?')[0].startsWith('/dashboard');
      });
  }

  /** Global sidebar item click → open that section on the dashboard. */
  goToSection(section: DashboardSection): void {
    this.router.navigate(['/dashboard'], { queryParams: { section } });
  }
}