import {
  HttpInterceptorFn, HttpErrorResponse, HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, BehaviorSubject, filter, take } from 'rxjs';
import { AuthService } from '../../services/auth'; // غير المسار لو مختلف

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Invalid email or password.',
  403: 'You don\'t have permission to do this.',
  404: 'The requested resource was not found.',
  409: 'This account already exists.',
  422: 'Invalid data. Please check your input.',
  429: 'Too many attempts. Please try again later.',
  500: 'Server error. Please try again later.',
  502: 'Service unavailable. Please try again later.',
  503: 'Service unavailable. Please try again later.',
};

const isTechnical = (msg: string): boolean => {
  const technicalPatterns = [
    /at\s+\w+\s*\(/,
    /Exception/,
    /System\./,
    /Microsoft\./,
    /Object reference/,
    /Http failure response/,
    /\w+:\d+:\d+/,
    /localhost/,
  ];
  return technicalPatterns.some(p => p.test(msg));
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((err) => {

      // ── Refresh Token Logic ───────────────────────────────────────────────
      if (err instanceof HttpErrorResponse && err.status === 401) {

        // لو الـ request نفسه هو refresh أو login → متعملش refresh تاني
        if (req.url.includes('/auth/refresh') || req.url.includes('/auth/login')) {
          isRefreshing = false;
          authService.clearSession();
          return throwError(() => new Error('Session expired. Please login again.'));
        }

        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refresh().pipe(
            switchMap((tokens) => {
              isRefreshing = false;
              refreshTokenSubject.next(tokens.accessToken);

              // أعد الـ request الأصلي بالتوكن الجديد
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
              });
              return next(retryReq);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              refreshTokenSubject.next(null);
              authService.clearSession();
              return throwError(() => new Error('Session expired. Please login again.'));
            })
          );

        } else {
          // لو في refresh جاري، استنى التوكن الجديد وبعدين أعد الـ request
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(token => {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${token!}` }
              });
              return next(retryReq);
            })
          );
        }
      }

      // ── Normal Error Handling ─────────────────────────────────────────────
      if (err instanceof Error) {
        const msg = isTechnical(err.message)
          ? 'Something went wrong. Please try again.'
          : err.message;
        return throwError(() => new Error(msg));
      }

      if (!(err instanceof HttpErrorResponse)) {
        if (err instanceof Error) {
          const msg = isTechnical(err.message)
            ? 'Something went wrong. Please try again.'
            : err.message;
          return throwError(() => new Error(msg));
        }
        return throwError(() => new Error('Something went wrong. Please try again.'));
      }

      let message = STATUS_MESSAGES[err.status] ?? 'Something went wrong. Please try again.';

      if (err.error) {
        const errorBody = err.error;
        let bodyMsg = '';

        if (typeof errorBody === 'string') {
          bodyMsg = errorBody;
        } else if (errorBody.message) {
          bodyMsg = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        } else if (Array.isArray(errorBody.errors)) {
          bodyMsg = errorBody.errors.join(', ');
        } else if (errorBody.errors && typeof errorBody.errors === 'object') {
          bodyMsg = Object.values(errorBody.errors).flat().join(', ');
        } else if (errorBody.title) {
          bodyMsg = errorBody.title;
        }

        if (bodyMsg && !isTechnical(bodyMsg)) {
          message = bodyMsg;
        }
      }

      console.error('HTTP ERROR:', err);
      return throwError(() => new Error(message));
    })
  );
};