import { Component, inject } from '@angular/core';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  private translate = inject(TranslateService);
  currentYear = new Date().getFullYear();

  get currentLang() {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }
}