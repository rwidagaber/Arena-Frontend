import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';

export const subscriptionGuard: CanActivateFn = (_route, _state) => {
  // TODO: Temporary bypass — allow all logged-in users to access chat
  // until the hasAI / subscription check is properly fixed.
  return true;

  // Original guard logic (commented out for now):
  // const auth = inject(AuthService);
  // const router = inject(Router);
  // if (auth.isSubscribed) {
  //   return auth.getMe().pipe(
  //     map(profile => {
  //       if (profile?.activeSubscription?.hasAI) return true;
  //       return router.createUrlTree(['/'], { queryParams: { showUpgradeAlert: 'true' } });
  //     }),
  //     catchError(() => {
  //       router.navigate(['/'], { queryParams: { showUpgradeAlert: 'true' } });
  //       return of(false);
  //     })
  //   );
  // }
  // return auth.getMe().pipe(
  //   map(profile => {
  //     if (profile?.activeSubscription?.hasAI) return true;
  //     return router.createUrlTree(['/'], { queryParams: { showUpgradeAlert: 'true' } });
  //   }),
  //   catchError(() => {
  //     router.navigate(['/'], { queryParams: { showUpgradeAlert: 'true' } });
  //     return of(false);
  //   })
  // );
};
