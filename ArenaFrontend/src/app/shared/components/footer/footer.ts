import { Component, inject } from '@angular/core';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  readonly t = inject(TranslationService);
  currentYear = new Date().getFullYear();

  get currentLang() {
    return this.t.currentLang();
  }
}