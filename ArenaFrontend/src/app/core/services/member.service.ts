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
    return this.http.get<GetProfileDto>(`${this.base}/auth/me`).pipe(
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
}
