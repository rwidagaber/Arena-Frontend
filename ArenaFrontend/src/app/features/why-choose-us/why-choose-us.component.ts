import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-why-choose-us',
  standalone: true,
  imports: [TranslateModule, CountUpDirective, ScrollRevealDirective, RouterLink],
  templateUrl: './why-choose-us.component.html',
  styleUrl: './why-choose-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhyChooseUsComponent {
  stats = [
    { number: 'WHY_CHOOSE_US.STAT_1_NUM', title: 'WHY_CHOOSE_US.STAT_1_TITLE', description: 'WHY_CHOOSE_US.STAT_1_DESC' },
    { number: 'WHY_CHOOSE_US.STAT_2_NUM', title: 'WHY_CHOOSE_US.STAT_2_TITLE', description: 'WHY_CHOOSE_US.STAT_2_DESC' },
    { number: 'WHY_CHOOSE_US.STAT_3_NUM', title: 'WHY_CHOOSE_US.STAT_3_TITLE', description: 'WHY_CHOOSE_US.STAT_3_DESC' },
    { number: 'WHY_CHOOSE_US.STAT_4_NUM', title: 'WHY_CHOOSE_US.STAT_4_TITLE', description: 'WHY_CHOOSE_US.STAT_4_DESC' }
  ];
}
