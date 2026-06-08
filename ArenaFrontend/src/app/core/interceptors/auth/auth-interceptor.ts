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

  // Combined endpoints from main and dev, fixing the broken semicolon syntax error
  const isPublicEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/confirm-email') ||
    req.url.includes('/auth/google-login') ||
    req.url.includes('/auth/reset-password') ||
    req.url.includes('/auth/logout');

  let authReq = req;

  if (!isPublicEndpoint && token) {
    authReq = addToken(token);
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      
      // Dev branch fix: If it's not 401, OR it's a failing refresh/logout request, pass the error through
      if (
        err.status !== 401 || 
        req.url.includes('/auth/refresh') || 
        req.url.includes('/auth/logout')
      ) {
        return throwError(() => err);
      }

      const refreshToken = auth.refreshToken;

      if (!refreshToken) {
        auth.logout().subscribe({ complete: () => router.navigate(['/']) });
        return throwError(() => err);
      }

      // Attempt to refresh the token gracefully
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