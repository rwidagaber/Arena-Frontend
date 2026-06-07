import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-why-choose-us',
  standalone: true,
  imports: [TranslateModule],
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
