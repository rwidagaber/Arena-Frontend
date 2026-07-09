import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

interface ProgramItem {
  title: string;
  description: string;
  icon: string;
  route: string;
  queryParams?: { [key: string]: string };
  image: string;
}

@Component({
  selector: 'app-programs',
  standalone: true,
  imports: [TranslateModule, ScrollRevealDirective, RouterLink],
  templateUrl: './programs.component.html',
  styleUrl: './programs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramsComponent {
  programs: ProgramItem[] = [
    {
      title: 'PROGRAMS.PROGRAM_1_TITLE',
      description: 'PROGRAMS.PROGRAM_1_DESC',
      icon: 'chat',
      route: '/chat',
      image: 'assets/images/program_ai_coach.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_2_TITLE',
      description: 'PROGRAMS.PROGRAM_2_DESC',
      icon: 'scan',
      route: '/dashboard',
      queryParams: { section: 'diet' },
      image: 'assets/images/program_meal_scanner.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_3_TITLE',
      description: 'PROGRAMS.PROGRAM_3_DESC',
      icon: 'body',
      route: '/dashboard',
      queryParams: { section: 'progress' },
      image: 'assets/images/program_body_model.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_4_TITLE',
      description: 'PROGRAMS.PROGRAM_4_DESC',
      icon: 'plan',
      route: '/dashboard',
      queryParams: { section: 'workout' },
      image: 'assets/images/program_workout_plan.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_5_TITLE',
      description: 'PROGRAMS.PROGRAM_5_DESC',
      icon: 'calendar',
      route: '/chat',
      image: 'assets/images/program_occupancy_peaks.png'
    },
    {
      title: 'PROGRAMS.PROGRAM_6_TITLE',
      description: 'PROGRAMS.PROGRAM_6_DESC',
      icon: 'qr',
      route: '/dashboard',
      queryParams: { section: 'qr' },
      image: 'assets/images/program_qr_entry.png'
    }
  ];
}
