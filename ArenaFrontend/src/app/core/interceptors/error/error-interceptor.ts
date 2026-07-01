import {
  HttpInterceptorFn, HttpErrorResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, BehaviorSubject, filter, take } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const STATUS_MESSAGE_KEYS: Record<number, string> = {
  400: 'auth.errors.invalidRequest',
  401: 'auth.errors.invalidCredentials',
  403: 'auth.errors.noPermission',
  404: 'auth.errors.notFound',
  409: 'auth.errors.emailExists',
  422: 'auth.errors.invalidData',
  429: 'auth.errors.tooManyAttempts',
  500: 'auth.errors.somethingWrong',
  502: 'auth.errors.serviceUnavailable',
  503: 'auth.errors.serviceUnavailable',
};

const DEFAULT_ERROR_KEY = 'auth.errors.somethingWrong';
const SESSION_EXPIRED_KEY = 'auth.errors.sessionExpired';

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

  if (req.url.includes('/i18n/')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const translate = inject(TranslateService);

  const translatedError = (key: string, params?: Record<string, unknown>) =>
    throwError(() => Object.assign(new Error(translate.instant(key, params)), { i18nKey: key, i18nParams: params }));

  return next(req).pipe(
    catchError((err) => {

      // ── Refresh Token Logic ───────────────────────────────────────────────
      if (err instanceof HttpErrorResponse && err.status === 401) {

        if (req.url.includes('/auth/refresh')) {
          isRefreshing = false;
          authService.clearSession();
          return translatedError(SESSION_EXPIRED_KEY);
        }

        if (!req.url.includes('/auth/login')) {

          if (!isRefreshing) {
            isRefreshing = true;
            refreshTokenSubject.next(null);

            return authService.refresh().pipe(
              switchMap((tokens) => {
                isRefreshing = false;
                refreshTokenSubject.next(tokens.accessToken);

                const retryReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
                });
                return next(retryReq);
              }),
              catchError((refreshErr) => {
                isRefreshing = false;
                refreshTokenSubject.next(null);
                authService.clearSession();
                return translatedError(SESSION_EXPIRED_KEY);
              })
            );

          } else {
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
      }

      // ── Normal Error Handling ─────────────────────────────────────────────
      if (!(err instanceof HttpErrorResponse)) {
        if (err instanceof Error) {
          const msg = isTechnical(err.message)
            ? translate.instant(DEFAULT_ERROR_KEY)
            : err.message;
          const key = isTechnical(err.message) ? DEFAULT_ERROR_KEY : (err as any).i18nKey;
          return throwError(() => Object.assign(new Error(msg), { i18nKey: key }));
        }
        return translatedError(DEFAULT_ERROR_KEY);
      }

      const statusKey = STATUS_MESSAGE_KEYS[err.status] ?? DEFAULT_ERROR_KEY;
      let message = translate.instant(statusKey);

      if (err.error) {
        const errorBody = err.error;
        let bodyMsg = '';

        if (Array.isArray(errorBody)) {
          bodyMsg = errorBody.join(', ');
        } else if (typeof errorBody === 'string') {
          bodyMsg = errorBody;
        } else if (errorBody.message) {
          bodyMsg = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        } else if (errorBody.error && typeof errorBody.error === 'string') {
          bodyMsg = errorBody.error;
        } else if (Array.isArray(errorBody.errors)) {
          bodyMsg = errorBody.errors.join(', ');
        } else if (errorBody.errors && typeof errorBody.errors === 'object') {
          bodyMsg = Object.values(errorBody.errors).flat().join(', ');
        } else if (errorBody.title) {
          bodyMsg = errorBody.title;
        }

        // ✅ هنا — بعد استخراج bodyMsg، اشيك على الـ code
        const serverCode = (typeof errorBody === 'object' && errorBody !== null)
          ? (errorBody as any).code as string | undefined
          : undefined;

        if (serverCode === 'GOOGLE_ACCOUNT_ONLY') {
          return translatedError('auth.errors.googleAccountOnly');
        }

        if (bodyMsg && !isTechnical(bodyMsg)) {
          message = bodyMsg;
        }
      }

      console.error('HTTP ERROR:', err);

      return throwError(() => Object.assign(new Error(message), { i18nKey: statusKey }));
    })
  );
};