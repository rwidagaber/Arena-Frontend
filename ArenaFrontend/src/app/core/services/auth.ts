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
} from '../models/auth';

const BASE = `${environment.apiUrl}/auth`;

const KEYS = {
  access: 'arena_access_token',
  refresh: 'arena_refresh_token',
  user: 'arena_user',
  subscribed: 'arena_subscribed',
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
    return !!this.accessToken;
  }

  get isSubscribed(): boolean {
    return localStorage.getItem(KEYS.subscribed) === 'true';
  }

  get accessToken(): string | null {
    return localStorage.getItem(KEYS.access);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(KEYS.refresh);
  }

  // ───────────────────────── API ─────────────────────────

  register(dto: UserRegisterDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${BASE}/register`, dto).pipe(
      tap(res => this._persist(res)),
      catchError(this._handleError)
    );
  }

  login(dto: UserLoginDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${BASE}/login`, dto).pipe(
      tap(res => this._persist(res)),
      catchError(this._handleError)
    );
  }

  refresh(): Observable<AuthResponseDto> {
    const dto: RefreshTokenDto = {
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
        this._user$.next(profile);
        localStorage.setItem(KEYS.user, JSON.stringify(profile));
      }),
      catchError(this._handleError)
    );
  }

  // ───────────────────────── Helpers ─────────────────────────

  private _persist(res: AuthResponseDto): void {
    localStorage.setItem(KEYS.access, res.accessToken);
    localStorage.setItem(KEYS.refresh, res.refreshToken);
    localStorage.setItem(KEYS.subscribed, String(res.isSubscribed));

    const user = {
      role: res.role,
      expiresAt: res.expiresAt,
      isSubscribed: res.isSubscribed,
    };

    localStorage.setItem(KEYS.user, JSON.stringify(user));
    this._user$.next(user as any);
  }

  private _clear(): void {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
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
  }

  else if (Array.isArray(error)) {
    msg = error.join(', ');
  }

  else if (error?.message) {
    msg = error.message;
  }

  else if (Array.isArray(error?.errors)) {
    msg = error.errors.join(', ');
  }

  else if (error?.errors && typeof error.errors === 'object') {
    msg = Object.values(error.errors)
      .flat()
      .join(', ');
  }

  else if (err?.message) {
    msg = err.message;
  }

  return throwError(() => new Error(msg));
}
}