import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/themeservice';
import { HttpClient } from '@angular/common/http';
import { MemberService } from '../../core/services/member.service';
import { environment } from '../../../environments/environment';

interface Metric {
  name: string;
  value: string;
  unit: string;
  status: 'good' | 'warning' | 'critical' | 'info';
  icon: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}

interface Alert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  advice: string;
  icon: string;
}

@Component({
  selector: 'app-health-monitor',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './health-monitor.component.html',
  styleUrls: ['./health-monitor.component.css']
})
export class HealthMonitorComponent implements OnInit {
  private readonly location = inject(Location);
  public readonly router = inject(Router);
  public readonly themeService = inject(ThemeService);
  private readonly http = inject(HttpClient);
  private readonly memberService = inject(MemberService);

  // Overall score & status state
  overallScore = 100;
  healthStatus: 'Good' | 'Warning' | 'Critical' = 'Good';
  memberProfileId: string = '';
  isLoading = false;
  isSimulating = false;
  currentActivityType = 'Resting';
  
  // Smartwatch simulation metrics (default placeholders)
  metrics: Metric[] = [
    { name: 'Heart Rate', value: '--', unit: 'BPM', status: 'good', icon: '❤️', trend: 'neutral', color: '#00FF87' },
    { name: 'Steps', value: '--', unit: 'steps', status: 'good', icon: '👟', trend: 'neutral', color: '#00FF87' },
    { name: 'Sleep', value: '--', unit: 'hours', status: 'good', icon: '😴', trend: 'neutral', color: '#00FF87' },
    { name: 'Calories', value: '--', unit: 'kcal', status: 'good', icon: '🔥', trend: 'neutral', color: '#00FF87' },
    { name: 'Water', value: '--', unit: 'Liters', status: 'good', icon: '💧', trend: 'neutral', color: '#00FF87' },
    { name: 'Stress', value: '--', unit: 'index', status: 'good', icon: '🧘', trend: 'neutral', color: '#00FF87' }
  ];

  // Active alerts list
  alerts: Alert[] = [];

  // History Chart data points (default placeholders)
  historyDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  historyBPM = [70, 70, 70, 70, 70, 70, 70];
  
  // Modal / popup state for AI insights
  showAIInsights = false;
  aiLoading = false;
  aiResponseText = '';
  
  // SVG Chart points calculation helper
  svgPoints = '';
  svgWidth = 500;
  svgHeight = 150;

  ngOnInit() {
    this.loadProfileAndData();
  }

  loadProfileAndData() {
    this.isLoading = true;
    this.memberService.getProfile().subscribe({
      next: (profile) => {
        this.memberProfileId = profile.memberProfileId;
        this.loadData();
      },
      error: (err) => {
        console.error('Error loading profile:', err);
        this.isLoading = false;
        this.calculateChartPoints();
      }
    });
  }

  loadData() {
    if (!this.memberProfileId) return;
    this.isLoading = true;

    const baseApi = environment.apiUrl;
    this.http.get<any>(`${baseApi}/smartwatch/analyze/${this.memberProfileId}`).subscribe({
      next: (res) => {
        if (res) {
          this.healthStatus = res.overallStatus || 'Good';
          
          let score = 100;
          const alertsList = res.alerts || [];
          alertsList.forEach((a: any) => {
            if (a.type === 'critical') score -= 25;
            else if (a.type === 'warning') score -= 12;
          });
          this.overallScore = Math.max(10, score);

          if (res.metrics) {
            this.metrics = this.mapMetrics(res.metrics, alertsList);
            this.currentActivityType = res.metrics.activityType || 'Resting';
          }
          this.alerts = this.mapAlerts(alertsList);
          this.aiResponseText = res.aiInsights || '✅ All good! Keep it up.';
        }
        
        // Fetch history
        this.http.get<any[]>(`${baseApi}/smartwatch/history/${this.memberProfileId}?days=7`).subscribe({
          next: (historyRes) => {
            if (historyRes && historyRes.length > 0) {
              this.mapHistory(historyRes);
            } else {
              this.calculateChartPoints();
            }
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading history:', err);
            this.calculateChartPoints();
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading analysis:', err);
        this.isLoading = false;
        this.calculateChartPoints();
      }
    });
  }

  triggerSimulation() {
    if (!this.memberProfileId) return;
    this.isSimulating = true;
    const baseApi = environment.apiUrl;
    this.http.post<any>(`${baseApi}/smartwatch/simulate/${this.memberProfileId}`, {}).subscribe({
      next: (res) => {
        this.loadData();
        this.isSimulating = false;
      },
      error: (err) => {
        console.error('Error triggering simulation:', err);
        this.isSimulating = false;
      }
    });
  }

  mapMetrics(apiMetrics: any, alerts: any[]): Metric[] {
    const getStatus = (name: string, val: number) => {
      const match = alerts.find(a => 
        a.category.toLowerCase().includes(name.toLowerCase()) || 
        a.message.toLowerCase().includes(name.toLowerCase())
      );
      if (match) {
        return match.type === 'critical' ? 'critical' : 'warning';
      }
      return 'good';
    };

    return [
      { name: 'Heart Rate', value: apiMetrics.heartRate.toString(), unit: 'BPM', status: getStatus('Heart', apiMetrics.heartRate), icon: '❤️', trend: apiMetrics.heartRate > 100 ? 'up' : 'neutral', color: apiMetrics.heartRate > 100 ? '#FF3B3B' : '#00FF87' },
      { name: 'Steps', value: apiMetrics.steps.toLocaleString(), unit: 'steps', status: getStatus('Steps', apiMetrics.steps), icon: '👟', trend: 'up', color: '#00FF87' },
      { name: 'Sleep', value: apiMetrics.sleepHours.toString(), unit: 'hours', status: getStatus('Sleep', apiMetrics.sleepHours), icon: '😴', trend: apiMetrics.sleepHours < 6 ? 'down' : 'neutral', color: apiMetrics.sleepHours < 6 ? '#FFB800' : '#00FF87' },
      { name: 'Calories', value: apiMetrics.caloriesBurned.toString(), unit: 'kcal', status: getStatus('Calories', apiMetrics.caloriesBurned), icon: '🔥', trend: 'up', color: '#00FF87' },
      { name: 'Water', value: `${apiMetrics.waterIntakeLiters} / 2.5`, unit: 'Liters', status: getStatus('Water', apiMetrics.waterIntakeLiters), icon: '💧', trend: 'neutral', color: getStatus('Water', apiMetrics.waterIntakeLiters) === 'warning' ? '#FFB800' : '#00FF87' },
      { name: 'Stress', value: `${apiMetrics.stressLevel}/10`, unit: 'index', status: getStatus('Stress', apiMetrics.stressLevel), icon: '🧘', trend: apiMetrics.stressLevel > 6 ? 'up' : 'neutral', color: apiMetrics.stressLevel > 6 ? '#FFB800' : '#00FF87' }
    ];
  }

  mapAlerts(apiAlerts: any[]): Alert[] {
    const iconMap: { [key: string]: string } = {
      'heart': 'bi-heart-pulse-fill',
      'sleep': 'bi-moon-stars-fill',
      'water': 'bi-droplet-fill',
      'hydration': 'bi-droplet-fill',
      'stress': 'bi-emoji-neutral-fill',
      'oxygen': 'bi-activity'
    };

    return apiAlerts.map((a, idx) => {
      const categoryLower = a.category.toLowerCase();
      let icon = 'bi-exclamation-triangle-fill';
      for (const key in iconMap) {
        if (categoryLower.includes(key)) {
          icon = iconMap[key];
          break;
        }
      }
      return {
        id: idx + 1,
        type: a.type as 'critical' | 'warning' | 'info',
        category: a.category,
        message: a.message,
        advice: a.advice,
        icon: icon
      };
    });
  }

  mapHistory(apiHistory: any[]) {
    const items = [...apiHistory].slice(0, 7).reverse();
    if (items.length > 0) {
      this.historyDays = items.map(h => {
        const d = new Date(h.recordedAt);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
      });
      this.historyBPM = items.map(h => h.heartRate);
    }
    this.calculateChartPoints();
  }

  formatAIResponse(text: string): string {
    if (!text) return '';
    let formatted = text
      .replace(/### (.*)/g, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/-\s(.*)/g, '<li>$1</li>')
      .replace(/\n/g, '<br>');
    return formatted;
  }

  goBack() {
    this.location.back();
  }

  setStatus(status: 'Good' | 'Warning' | 'Critical') {
    this.healthStatus = status;
    if (status === 'Good') {
      this.overallScore = 88;
      this.metrics[0].value = '128';
      this.metrics[0].status = 'critical';
      this.metrics[2].value = '6.2';
      this.metrics[2].status = 'warning';
      this.metrics[4].value = '1.8 / 2.5';
      this.metrics[4].status = 'warning';
      this.metrics[5].value = '6/10';
      this.metrics[5].status = 'warning';
    } else if (status === 'Warning') {
      this.overallScore = 65;
      this.metrics[0].value = '135';
      this.metrics[0].status = 'critical';
      this.metrics[2].value = '5.8';
      this.metrics[2].status = 'warning';
      this.metrics[4].value = '1.5 / 2.5';
      this.metrics[4].status = 'critical';
      this.metrics[5].value = '8/10';
      this.metrics[5].status = 'critical';
    } else {
      this.overallScore = 42;
      this.metrics[0].value = '155';
      this.metrics[0].status = 'critical';
      this.metrics[2].value = '4.5';
      this.metrics[2].status = 'critical';
      this.metrics[4].value = '1.0 / 2.5';
      this.metrics[4].status = 'critical';
      this.metrics[5].value = '9/10';
      this.metrics[5].status = 'critical';
    }
    this.calculateChartPoints();
  }

  dismissAlert(id: number) {
    this.alerts = this.alerts.filter(alert => alert.id !== id);
  }

  calculateChartPoints() {
    const paddingX = 40;
    const paddingY = 20;
    const chartW = this.svgWidth - paddingX * 2;
    const chartH = this.svgHeight - paddingY * 2;
    
    const minVal = 50;
    const maxVal = 180;
    const valRange = maxVal - minVal;

    const currentBPM = parseInt(this.metrics[0].value) || 70;
    const currentHistory = [...this.historyBPM];
    if (currentHistory.length > 0) {
      currentHistory[currentHistory.length - 1] = currentBPM;
    }

    const pointsArr = currentHistory.map((val, idx) => {
      const x = paddingX + (idx / (currentHistory.length - 1)) * chartW;
      const y = this.svgHeight - paddingY - ((val - minVal) / valRange) * chartH;
      return { x, y, val };
    });

    this.svgPoints = pointsArr.map(p => `${p.x},${p.y}`).join(' ');
  }

  getChartPoints() {
    const paddingX = 40;
    const paddingY = 20;
    const chartW = this.svgWidth - paddingX * 2;
    const chartH = this.svgHeight - paddingY * 2;
    
    const minVal = 50;
    const maxVal = 180;
    const valRange = maxVal - minVal;

    const currentBPM = parseInt(this.metrics[0].value) || 70;
    const currentHistory = [...this.historyBPM];
    if (currentHistory.length > 0) {
      currentHistory[currentHistory.length - 1] = currentBPM;
    }

    return currentHistory.map((val, idx) => {
      const x = paddingX + (idx / (currentHistory.length - 1)) * chartW;
      const y = this.svgHeight - paddingY - ((val - minVal) / valRange) * chartH;
      return { x, y, val, day: this.historyDays[idx] };
    });
  }

  triggerAIInsights() {
    this.showAIInsights = true;
    this.aiLoading = true;
    // Loading state for visual polish, then show real insights loaded from backend
    setTimeout(() => {
      this.aiLoading = false;
    }, 1000);
  }

  closeAIModal() {
    this.showAIInsights = false;
  }

  getActivityEmoji(type: string): string {
    switch (type?.toLowerCase()) {
      case 'gym': return '🏋️';
      case 'walking': return '🚶';
      case 'running': return '🏃';
      case 'sleeping': return '😴';
      default: return '🧘';
    }
  }
}
