import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WorkingHoursDto {
  id: number;
  dayOfWeek: number | string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkingHoursService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/working-hours`;

  getWorkingHours(): Observable<WorkingHoursDto[]> {
    return this.http.get<WorkingHoursDto[]>(this.apiUrl);
  }
}
