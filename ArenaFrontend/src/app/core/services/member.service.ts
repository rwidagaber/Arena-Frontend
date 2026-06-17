import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GetProfileDto } from '../models/auth';
import { MemberProfile, UpdateProfileDto } from '../models/member';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  getProfile(): Observable<MemberProfile> {
    // Read from /profile (ProfileController) — it returns goal & targetWeight,
    // which /auth/me omits. The member dashboard is subscription-gated, so the
    // subscription-locked fields on this endpoint are never hit here.
    return this.http.get<GetProfileDto>(`${this.base}/profile`).pipe(
      map(dto => ({
        id: dto.id,
         memberProfileId: dto.memberProfileId ?? dto.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phoneNumber: dto.phoneNumber ?? null,
        preferredLanguage: dto.preferredLanguage,
        isActive: dto.isActive ?? true,
        weight: dto.weight ?? null,
        height: dto.height ?? null,
        bmi: dto.bmi ?? null,
        targetWeight: dto.targetWeight ?? null,
        goal: dto.goal ?? null,
        gender: dto.gender ?? null,
        profileImage: dto.profileImage ?? null,
        birthday: dto.birthday ?? null,
        activeSubscription: dto.activeSubscription ?? null,
      }))
    );
  }

  updateProfile(dto: UpdateProfileDto): Observable<MemberProfile> {
    return this.http.put<MemberProfile>(`${this.base}/profile`, dto);
  }

  getUserSubscriptions(memberProfileId: string): Observable<import('../models/auth').UserSubscriptionDto[]> {
    return this.http.get<import('../models/auth').UserSubscriptionDto[]>(`${this.base}/user-subscriptions/member/${memberProfileId}`);
  }
}
