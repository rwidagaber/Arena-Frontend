import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth';

export const subscriptionGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSubscribed) return true;

  return router.createUrlTree(['/home']);
};
