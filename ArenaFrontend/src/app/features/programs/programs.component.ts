import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-programs',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './programs.component.html',
  styleUrl: './programs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramsComponent {
  programs = [
    {
      title: 'PROGRAMS.PROGRAM_1_TITLE',
      description: 'PROGRAMS.PROGRAM_1_DESC',
      icon: 'weight-loss',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-1-gold.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_2_TITLE',
      description: 'PROGRAMS.PROGRAM_2_DESC',
      icon: 'strength',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-2-gold.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_3_TITLE',
      description: 'PROGRAMS.PROGRAM_3_DESC',
      icon: 'cardio',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-3-gold.png'
    }
  ];
}
