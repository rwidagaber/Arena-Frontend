import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WorkingHoursDay } from '../models/gym';

/** Fallback (mirrors the current DB values) used only if the request fails,
 *  so the footer still renders sensible hours. */
export const DEFAULT_WORKING_HOURS: WorkingHoursDay[] = [
  { dayOfWeek: 0, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 1, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 4, openTime: '15:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00:00', closeTime: '03:00:00', isClosed: false },
];

@Injectable({ providedIn: 'root' })
export class GymService {
  private http = inject(HttpClient);

  /** Gym working hours from the DB (GET /api/working-hours). Falls back to
   *  DEFAULT_WORKING_HOURS on error so the UI degrades gracefully. */
  getWorkingHours(): Observable<WorkingHoursDay[]> {
    return this.http.get<WorkingHoursDay[]>(`${environment.apiUrl}/working-hours`).pipe(
      catchError(() => of(DEFAULT_WORKING_HOURS))
    );
  }
}
