import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-why-choose-us',
  standalone: true,
  imports: [],
  templateUrl: './why-choose-us.component.html',
  styleUrl: './why-choose-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhyChooseUsComponent {
  stats = [
    { number: '12+', title: 'Years Experience', description: 'With over a decade of experience' },
    { number: '80+', title: 'Active & Motivated Members', description: 'Our gym is home to a thriving' },
    { number: '35+', title: 'Certified Fitness Professionals', description: 'Our team of certified trainers brings' },
    { number: '60+', title: 'Specialized Training Programs', description: 'We offer a wide variety of structure' }
  ];
}
