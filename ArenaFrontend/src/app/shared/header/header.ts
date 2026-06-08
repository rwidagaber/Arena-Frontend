import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslationService, Lang } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  private readonly router = inject(Router);
  readonly t = inject(TranslationService);
  readonly auth = inject(AuthService);

  @Input() isLoggedIn: boolean = false;
  @Input() activeTab: string = 'home';
  @Output() tabChange = new EventEmitter<string>();

  get currentLang(): Lang {
    return this.t.currentLang();
  }

  toggleLang(): void {
    this.t.switchLang(this.currentLang === 'en' ? 'ar' : 'en');
  }

  navigateToTab(tabName: string, event: Event): void {
    event.preventDefault();
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
    if (tabName === 'home') {
      this.router.navigate(['/']);
    }
  }
}