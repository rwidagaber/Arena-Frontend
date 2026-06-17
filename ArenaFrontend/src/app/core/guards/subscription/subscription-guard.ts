import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';

export const subscriptionGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Must be logged in first.
  if (!auth.isLoggedIn) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  // Verify the subscription against the server (source of truth);
  // getMe() also refreshes the locally stored subscription flag.
  return auth.getMe().pipe(
    map(profile => (profile?.activeSubscription ? true : router.createUrlTree(['/']))),
    catchError(() => of(router.createUrlTree(['/'])))
  );
};
