import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  activeTab: string = 'mission';

  translationService = inject(TranslationService);

  get isRtl(): boolean {
    return this.translationService.currentLang() === 'ar';
  }
}