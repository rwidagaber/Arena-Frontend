import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';

export const subscriptionGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSubscribed) {
    auth.getMe().subscribe();
    return true;
  }

  return auth.getMe().pipe(
    map(profile => {
      if (profile?.activeSubscription) return true;
      return router.createUrlTree(['/home']);
    }),
    catchError(() => {
      if (auth.isSubscribed) return of(true);
      router.navigate(['/home']);
      return of(false);
    })
  );
};
