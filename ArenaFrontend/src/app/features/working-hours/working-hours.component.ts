import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WorkingHoursService, WorkingHoursDto } from './working-hours.service';
import { TranslationService } from '../../core/services/translation.service';

export interface ParsedScheduleItem {
  id: number;
  dayName: string; // 'Monday', 'Tuesday', etc.
  openTime: string; // '08:00:00'
  closeTime: string; // '03:00:00'
  isClosed: boolean;
  iconClass: string;
  isToday: boolean;
}

@Component({
  selector: 'app-working-hours',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule
  ],
  templateUrl: './working-hours.component.html',
  styleUrl: './working-hours.component.css'
})
export class WorkingHoursComponent implements OnInit, OnDestroy {
  private service = inject(WorkingHoursService);
  private translate = inject(TranslateService);
  protected translationService = inject(TranslationService);

  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  schedule = signal<ParsedScheduleItem[]>([]);
  isOpen = signal<boolean>(false);
  activeShiftDay = signal<string>(''); // Day name of currently active shift

  private statusInterval?: any;

  private readonly dayOrder: Record<string, number> = {
    'Saturday': 0,
    'Sunday': 1,
    'Monday': 2,
    'Tuesday': 3,
    'Wednesday': 4,
    'Thursday': 5,
    'Friday': 6
  };

  private readonly dayIcons: Record<string, string> = {
    'Saturday': 'bi bi-calendar2-week',
    'Sunday': 'bi bi-sun',
    'Monday': 'bi bi-lightning',
    'Tuesday': 'bi bi-fire',
    'Wednesday': 'bi bi-heart-pulse',
    'Thursday': 'bi bi-activity',
    'Friday': 'bi bi-trophy'
  };

  ngOnInit(): void {
    this.fetchSchedule();
    
    // Periodically update the status (every 30 seconds)
    this.statusInterval = setInterval(() => {
      this.updateGymStatus();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
  }

  fetchSchedule(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getWorkingHours().subscribe({
      next: (data) => {
        if (!data || data.length === 0) {
          this.error.set('workingHours.errorLoading');
          this.loading.set(false);
          return;
        }

        const parsed = data.map(item => {
          const dayName = this.getDayName(item.dayOfWeek);
          return {
            id: item.id,
            dayName: dayName,
            openTime: item.openTime,
            closeTime: item.closeTime,
            isClosed: item.isClosed,
            iconClass: this.dayIcons[dayName] || 'bi bi-clock',
            isToday: false
          } as ParsedScheduleItem;
        });

        // Sort Saturday -> Friday
        parsed.sort((a, b) => this.dayOrder[a.dayName] - this.dayOrder[b.dayName]);

        this.schedule.set(parsed);
        this.updateGymStatus();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading schedule:', err);
        this.error.set('workingHours.errorLoading');
        this.loading.set(false);
      }
    });
  }

  private getDayName(day: number | string): string {
    if (typeof day === 'number') {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[day] || '';
    }
    return day;
  }

  private updateGymStatus(): void {
    const list = this.schedule();
    if (list.length === 0) return;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = now.getDay(); // 0 = Sunday, ..., 6 = Saturday
    const todayName = dayNames[todayIndex];

    const yesterdayIndex = (todayIndex - 1 + 7) % 7;
    const yesterdayName = dayNames[yesterdayIndex];

    let gymOpen = false;
    let activeDay = todayName;

    const todayItem = list.find(item => item.dayName === todayName);
    const yesterdayItem = list.find(item => item.dayName === yesterdayName);

    // 1. Check yesterday's shift if it crossed midnight
    if (yesterdayItem && !yesterdayItem.isClosed && yesterdayItem.openTime && yesterdayItem.closeTime) {
      const [openH, openM] = yesterdayItem.openTime.split(':').map(Number);
      const [closeH, closeM] = yesterdayItem.closeTime.split(':').map(Number);
      const openTimeInMinutes = openH * 60 + openM;
      const closeTimeInMinutes = closeH * 60 + closeM;

      if (closeTimeInMinutes < openTimeInMinutes) {
        // Shift crosses midnight. Check if current time is before the close time today.
        if (currentTimeInMinutes < closeTimeInMinutes) {
          gymOpen = true;
          activeDay = yesterdayName;
        }
      }
    }

    // 2. If not active on yesterday's shift, check today's shift
    if (!gymOpen && todayItem && !todayItem.isClosed && todayItem.openTime && todayItem.closeTime) {
      const [openH, openM] = todayItem.openTime.split(':').map(Number);
      const [closeH, closeM] = todayItem.closeTime.split(':').map(Number);
      const openTimeInMinutes = openH * 60 + openM;
      const closeTimeInMinutes = closeH * 60 + closeM;

      if (closeTimeInMinutes < openTimeInMinutes) {
        // Shift crosses midnight
        if (currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes) {
          gymOpen = true;
          activeDay = todayName;
        }
      } else {
        // Normal day shift
        if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
          gymOpen = true;
          activeDay = todayName;
        }
      }
    }

    this.isOpen.set(gymOpen);
    this.activeShiftDay.set(activeDay);

    // Update isToday highlighting
    const updatedList = list.map(item => ({
      ...item,
      isToday: item.dayName === todayName
    }));
    this.schedule.set(updatedList);
  }

  formatTime(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    const lang = this.translate.currentLang || 'en';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    
    let ampm = hours >= 12 ? 'PM' : 'AM';
    if (lang === 'ar') {
      ampm = hours >= 12 ? 'م' : 'ص';
    }
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  get currentLang(): string {
    return this.translate.currentLang || 'en';
  }
}
