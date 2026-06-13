import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.accessToken;

  const addToken = (t: string) =>
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${t}`
      }
    });

  const isPublicEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/confirm-email') ||
    req.url.includes('/auth/google-login') ||
    req.url.includes('/auth/reset-password') ||
    req.url.includes('/auth/logout') ||
    req.url.includes('/auth/resend-confirmation');

  const authReq = (!isPublicEndpoint && token) ? addToken(token) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {

      // مش 401 أو endpoint مش محتاج refresh → ابعت الـ error عادي
      if (
        err.status !== 401 ||
        req.url.includes('/auth/refresh') ||
        req.url.includes('/auth/logout') ||
        req.url.includes('/auth/login')
      ) {
        return throwError(() => err);
      }

      const refreshToken = auth.refreshToken;

      // مفيش refresh token → امسح الـ session وروح الـ home
      if (!refreshToken) {
        auth.clearSession();
        router.navigate(['/']);
        return throwError(() => err);
      }

      // حاول تعمل refresh للـ token
      return auth.refresh().pipe(
        switchMap((res) => next(addToken(res.accessToken))),
        catchError((refreshErr) => {
          auth.clearSession();
          router.navigate(['/']);
          return throwError(() => refreshErr);
        })
      );
    })
  );
};