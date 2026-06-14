import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) return true;

  // لو logged in → روح المكان الصح
  if (auth.isSubscribed) {
    router.navigate(['/dashboard']);
  } else {
    router.navigate(['/']);
  }
  return false;

};