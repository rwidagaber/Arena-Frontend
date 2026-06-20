import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth';

export const subscriptionGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Quick check from cached state
  if (auth.isSubscribed) {
    // Verify the subscription includes AI access
    return auth.getMe().pipe(
      map(profile => {
        if (profile?.activeSubscription?.hasAI) return true;
        // Subscribed but no AI access → redirect to pricing
        return router.createUrlTree(['/'], { queryParams: { showUpgradeAlert: 'true' } });
      }),
      catchError(() => {
        router.navigate(['/'], { queryParams: { showUpgradeAlert: 'true' } });
        return of(false);
      })
    );
  }

  // Not subscribed at all → verify via API
  return auth.getMe().pipe(
    map(profile => {
      if (profile?.activeSubscription?.hasAI) return true;
      return router.createUrlTree(['/'], { queryParams: { showUpgradeAlert: 'true' } });
    }),
    catchError(() => {
      router.navigate(['/'], { queryParams: { showUpgradeAlert: 'true' } });
      return of(false);
    })
  );
};
