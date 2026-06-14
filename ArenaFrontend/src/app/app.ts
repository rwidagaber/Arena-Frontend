import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/components/footer/footer';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from '../app/core/services/themeservice';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private translate = inject(TranslateService);
  private theme = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  showLayout = true;

  ngOnInit(): void {

    const storedLang = localStorage.getItem('arena_lang') || 'en';
    this.translate.use(storedLang);

    document.documentElement.dir = storedLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLang;

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        let route = this.activatedRoute;

        while (route.firstChild) {
          route = route.firstChild;
        }

        this.showLayout = !route.snapshot.data['hideLayout'];
      });
  }
}