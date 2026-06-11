import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  GetProfileDto,
  RefreshTokenDto,
  ResetPasswordDto,
  UserLoginDto,
  UserRegisterDto,
  CompleteProfileDto
} from '../models/auth';

const BASE = `${environment.apiUrl}/auth`;

const KEYS = {
  access: 'arena_access_token',
  refresh: 'arena_refresh_token',
  user: 'arena_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user$ = new BehaviorSubject<GetProfileDto | null>(
    this._loadUser()
  );

  readonly currentUser$ = this._user$.asObservable();

  get isLoggedIn(): boolean {
    return !!localStorage.getItem(KEYS.access) ||
           !!sessionStorage.getItem(KEYS.access);
  }

  get isSubscribed(): boolean {
    try {
      const raw = localStorage.getItem(KEYS.user)
               ?? sessionStorage.getItem(KEYS.user);
      return raw ? JSON.parse(raw).isSubscribed === true : false;
    } catch {
      return false;
    }
  }

  get accessToken(): string | null {
    return localStorage.getItem(KEYS.access) ?? sessionStorage.getItem(KEYS.access);
  }

  get userRole(): string | null {
    try {
      const raw = localStorage.getItem(KEYS.user);
      if (raw) {
        const user = JSON.parse(raw);
        return user.role || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  get refreshToken(): string | null {
    return localStorage.getItem(KEYS.refresh) ?? sessionStorage.getItem(KEYS.refresh);
  }

  // ───────────────────────── API ─────────────────────────

  register(dto: UserRegisterDto): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${BASE}/register`, dto).pipe(
      catchError(this._handleError)
    );
  }

  login(dto: UserLoginDto, rememberMe = false): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${BASE}/login`, dto).pipe(
      tap(res => this._persist(res, rememberMe)),
      catchError(this._handleError)
    );
  }

  refresh(): Observable<AuthResponseDto> {
    const dto: RefreshTokenDto = {
      accessToken: this.accessToken ?? '',
      refreshToken: this.refreshToken ?? ''
    };

    return this.http.post<AuthResponseDto>(`${BASE}/refresh`, dto).pipe(
      tap(res => this._persist(res)),
      catchError(err => {
        this._clear();
        return throwError(() => err);
      })
    );
  }

  googleLogin(idToken: string): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${BASE}/google-login`, { idToken }).pipe(
      tap(res => this._persist(res)),
      catchError(this._handleError)
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${BASE}/logout`, {}).pipe(
      tap(() => this._clear()),
      catchError(err => {
        this._clear();
        return throwError(() => err);
      })
    );
  }

  getMe(): Observable<GetProfileDto> {
    return this.http.get<GetProfileDto>(`${BASE}/me`).pipe(
      tap(profile => {
        const isSubscribed = !!profile.activeSubscription;
        const frontendRole = isSubscribed ? 'Member' : 'User';

        const updatedUser = { ...profile, role: frontendRole, isSubscribed };
        this._user$.next(updatedUser as any);
        localStorage.setItem(KEYS.user, JSON.stringify(updatedUser));
      }),
      catchError(this._handleError)
    );
  }

  confirmEmail(userId: string, otp: string): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${BASE}/confirm-email`, { userId, otp }).pipe(
      tap(res => this._persist(res)),
      catchError(this._handleError)
    );
  }

  forgotPassword(dto: ForgotPasswordDto): Observable<void> {
    return this.http.post<void>(`${BASE}/forgot-password`, dto).pipe(
      catchError(this._handleError)
    );
  }

  completeProfile(dto: CompleteProfileDto): Observable<void> {
    return this.http.post<void>(`${BASE}/complete-profile`, dto).pipe(
      catchError(this._handleError)
    );
  }

  resetPassword(dto: ResetPasswordDto): Observable<void> {
    return this.http.post<void>(`${BASE}/reset-password`, dto).pipe(
      catchError(this._handleError)
    );
  }

  // ───────────────────────── Helpers ─────────────────────────

  private _persist(res: AuthResponseDto, rememberMe = false): void {
    const storage = rememberMe ? localStorage : sessionStorage;

    storage.setItem(KEYS.access, res.accessToken);
    storage.setItem(KEYS.refresh, res.refreshToken);

    const frontendRole = res.isSubscribed ? 'Member' : 'User';

    const user = {
      role: frontendRole,
      backendRole: res.role,
      expiresAt: res.expiresAt,
      isSubscribed: res.isSubscribed ?? false
    };
    storage.setItem(KEYS.user, JSON.stringify(user));
    this._user$.next(user as any);
  }

  private _clear(): void {
    Object.values(KEYS).forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    this._user$.next(null);
    this.router.navigate(['/']);
  }

  private _loadUser(): GetProfileDto | null {
    try {
      const raw = localStorage.getItem(KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private _handleError(err: any): Observable<never> {
    let msg = 'Something went wrong';

    const error = err?.error;

    if (typeof error === 'string') {
      msg = error;
    } else if (Array.isArray(error)) {
      msg = error.join(', ');
    } else if (error?.message) {
      msg = error.message;
    } else if (Array.isArray(error?.errors)) {
      msg = error.errors.join(', ');
    } else if (error?.errors && typeof error.errors === 'object') {
      msg = Object.values(error.errors)
        .flat()
        .join(', ');
    } else if (err?.message) {
      msg = err.message;
    }

    return throwError(() => new Error(msg));
  }
}