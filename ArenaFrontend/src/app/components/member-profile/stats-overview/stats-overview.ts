import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export interface StatItem {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-stats-overview',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './stats-overview.html',
  styleUrl: './stats-overview.css',
})
export class StatsOverview {
  stats = input<StatItem[]>([]);
  loading = input<boolean>(false);
}
