import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MemberProfile,
  UpdateProfileDto,
  WorkoutSession,
  MembershipDetails,
} from '../models/member';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/members`;

  getProfile(): Observable<MemberProfile> {
    return this.http.get<MemberProfile>(`${this.base}/profile`);
  }

  updateProfile(dto: UpdateProfileDto): Observable<MemberProfile> {
    return this.http.put<MemberProfile>(`${this.base}/profile`, dto);
  }

  getWorkoutHistory(): Observable<WorkoutSession[]> {
    return this.http.get<WorkoutSession[]>(`${this.base}/workouts`);
  }

  getMembership(): Observable<MembershipDetails> {
    return this.http.get<MembershipDetails>(`${this.base}/membership`);
  }
}
