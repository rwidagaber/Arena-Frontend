import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth';

/** يحمي الـ routes اللي محتاجة login */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) return true;

  router.navigate(['/'], { queryParams: { returnUrl: state.url } });
  return false;
};