import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProgressLogDto {
  id: string;
  weight: number;
  bodyFat: number | null;
  muscleMass: number | null;
  loggedAt: string;
}

export interface ProgressSummaryDto {
  currentWeight: number;
  currentBodyFat: number | null;
  currentMuscleMass: number | null;
  weightChange: number | null;
  bodyFatChange: number | null;
  muscleMassChange: number | null;
  logs: ProgressLogDto[];
}

export interface CreateProgressLogDto {
  weight: number;
  bodyFat?: number | null;
  muscleMass?: number | null;
}

export interface AttendanceRecord {
  id: string;
  bookingId: string;
  memberProfileId: string;
  checkInTime: string | null;
  scannedById: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProgressReportService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  getProgress(): Observable<ProgressSummaryDto> {
    return this.http.get<ProgressSummaryDto>(`${this.base}/progress`);
  }

  getAttendances(memberProfileId: string): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(`${this.base}/attendance/member/${memberProfileId}`);
  }

  createProgressEntry(dto: CreateProgressLogDto): Observable<ProgressLogDto> {
    return this.http.post<ProgressLogDto>(`${this.base}/progress`, dto);
  }

  deleteProgressEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/progress/${id}`);
  }
}
