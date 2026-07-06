import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RoutesRecognized, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/components/footer/footer';
import { FloatingChatButtonComponent } from './shared/components/floating-chat-button/floating-chat-button';
import { BackToTopComponent } from './shared/components/back-to-top/back-to-top';
import { DashboardSidebar, DashboardSection } from './components/member-profile/dashboard-sidebar/dashboard-sidebar';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from '../app/core/services/themeservice';
import { AuthService } from './core/services/auth';
import { CustomAlertComponent } from './features/notifications/custom-alert/custom-alert';
import { filter } from 'rxjs/operators';
import { routes } from './app.routes';

/**
 * بيحسب هل الـ route الحالي (بناءً على الـ URL الفعلي في المتصفح وقت
 * التحميل) عنده hideLayout/hideFooter في تعريف الـ routes — من غير ما
 * ينتظر أي Router event. كده أول render للصفحة بيبقى بالقيمة الصح على
 * طول، ومفيش ومضة في أي الاتجاهين (لا للصفحات اللي فيها Header/Footer
 * ولا للصفحات اللي مخفيين فيها).
 */
function computeInitialLayoutFlags(): { hideLayout: boolean; hideFooter: boolean } {
  const firstSegment = window.location.pathname.replace(/^\//, '').split('/')[0];
  const matched = routes.find(r => r.path === firstSegment);
  const data = (matched?.data ?? {}) as { hideLayout?: boolean; hideFooter?: boolean };
  return { hideLayout: !!data.hideLayout, hideFooter: !!data.hideFooter };
}

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

  // ✅ بنحسب القيمة الصح من أول لحظة (sync)، بدل ما نفترض true أو false
  // وننتظر Router event يصححها لاحقًا — وده اللي كان بيسبب الومضة
  // (في أي الاتجاهين حسب القيمة الافتراضية المختارة).
  private readonly _initialFlags = computeInitialLayoutFlags();
  showLayout = !this._initialFlags.hideLayout;
  showFooter = !this._initialFlags.hideFooter;

  /** True on the dashboard route, where the member-profile renders its OWN
   *  sidebar — so the global one is suppressed there to avoid duplicates. */
  isDashboard = false;

  /** True on the chat route, which owns the full width with its own history
   *  sidebar — so the global subscriber sidebar is suppressed there too. */
  isChat = false;

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

    // الحساب الأولي فوق بيغطي أول تحميل (Hard load) بس.
    // لأي navigation تاني بعد كده (تنقل جوه الـ SPA زي login -> dashboard)
    // لازم نفضل نحدّث القيم دي، فبنمسك RoutesRecognized (بيطلق بدري) +
    // NavigationEnd كـ fallback.
    this.router.events
      .pipe(
        filter(event =>
          event instanceof RoutesRecognized || event instanceof NavigationEnd
        )
      )
      .subscribe(event => {

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
        this.isChat = this.router.url.split('?')[0].startsWith('/chat');
      });
  }

  /** Global sidebar item click → open that section on the dashboard. */
  goToSection(section: DashboardSection): void {
    this.router.navigate(['/dashboard'], { queryParams: { section } });
  }
}