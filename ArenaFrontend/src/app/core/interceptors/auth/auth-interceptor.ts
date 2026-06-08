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

  // 🚨 مهم: استثناء endpoints اللي لازم تكون anonymous
  const isPublicEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/logout');

  // ❌ ما نضيفش token في الـ public endpoints
  let authReq = req;

  if (!isPublicEndpoint && token) {
    authReq = addToken(token);
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {

      // ❌ لو مش 401 أو request refresh/logout نفسه → رجّع error زي ما هو
      if (err.status !== 401 || req.url.includes('/auth/refresh') || req.url.includes('/auth/logout')) {
        return throwError(() => err);
      }

      // 🔁 حاول refresh token
      const refreshToken = auth.refreshToken;

      if (!refreshToken) {
        auth.logout().subscribe({ complete: () => router.navigate(['/']) });
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        switchMap((res) => {
          const newReq = addToken(res.accessToken);
          return next(newReq);
        }),
        catchError((refreshErr) => {
          auth.logout().subscribe({ complete: () => router.navigate(['/']) });
          return throwError(() => refreshErr);
        })
      );
    })
  );
};