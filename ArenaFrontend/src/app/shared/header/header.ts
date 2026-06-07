import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent implements OnInit {
  private readonly router = inject(Router);
  public readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  @Input() isLoggedIn: boolean = false;
  @Input() activeTab: string = 'home';
  @Output() tabChange = new EventEmitter<string>();

  currentLang: string = 'en';

  ngOnInit(): void {
    // Restore saved language from localStorage, default to 'en'
    const savedLang = localStorage.getItem('lang') || 'en';
    this.currentLang = savedLang;
    this.translate.use(savedLang);
    this.applyDirection(savedLang);
  }

  switchLanguage(): void {
    // Toggle between 'en' and 'ar'
    this.currentLang = this.currentLang === 'en' ? 'ar' : 'en';
    this.translate.use(this.currentLang);
    localStorage.setItem('lang', this.currentLang);
    this.applyDirection(this.currentLang);
  }

  private applyDirection(lang: string): void {
    // Set RTL/LTR on the document for Arabic/English
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }

  navigateToTab(tabName: string, event: Event): void {
    event.preventDefault();
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
    if (tabName === 'home') {
      this.router.navigate(['/home']);
    } else if (tabName === 'about') {
      this.router.navigate(['/about']);
    }
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}