import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { inject } from '@angular/core';

export const resetPasswordGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  // لو logged in مينفعش يوصل لـ reset-password
  if (auth.isLoggedIn) {
    router.navigate(['/']);
    return false;
  }

  // لازم يكون جاي بـ token في الـ URL
  const token = route.queryParamMap.get('token');
  const email = route.queryParamMap.get('email');
  if (!token || !email) {
    router.navigate(['/forgot-password']);
    return false;
  }

  return true;
};
