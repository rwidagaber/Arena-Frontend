import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

export interface StatItem {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-stats-overview',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './stats-overview.html',
  styleUrl: './stats-overview.css',
})
export class StatsOverview {
  stats = input<StatItem[]>([]);
  loading = input<boolean>(false);
}
