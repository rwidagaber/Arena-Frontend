import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-programs',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './programs.component.html',
  styleUrl: './programs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgramsComponent {
  programs = [
    {
      title: 'Weight Loss Program',
      description: 'Our Weight Loss Program is designed to help you burn fat, boost metabolism, and build a healthier lifestyle',
      icon: 'weight-loss',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-1-gold.png'
    },
    {
      title: 'Strength Training',
      description: 'Our Strength Training program is designed to help you build muscle, increase power, and improve overall',
      icon: 'strength',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-2-gold.png'
    },
    {
      title: 'Cardio & Endurance Training',
      description: 'Our Cardio & Endurance Training program is designed to improve heart health, boost stamina, and enhance',
      icon: 'cardio',
      image: 'https://demo.awaikenthemes.com/gympro/wp-content/uploads/2026/01/our-programs-image-3-gold.png'
    }
  ];
}
