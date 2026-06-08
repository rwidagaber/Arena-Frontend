import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Get allowed roles from route data
  const allowedRoles = route.data?.['roles'] as string[];

  // If no roles required, let them in
  if (!allowedRoles || allowedRoles.length === 0) return true;

  // Check if user has required role
  const userRole = auth.userRole;
  if (userRole && allowedRoles.includes(userRole)) {
    return true;
  }

  // Not allowed, alert the user and redirect to home
  window.alert('This feature is for Members only! Please subscribe to a plan to access it.');
  return router.createUrlTree(['/']);
};
