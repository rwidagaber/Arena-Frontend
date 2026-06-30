import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

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
  notificationService.showAlert({
    type: 'Error',
    eyebrow: 'Access Denied',
    title: 'Membership Required',
    message: 'This feature is for Members only! Please subscribe to a plan to access it.',
    ctaText: 'View Pricing',
    secondaryCtaText: 'Dismiss'
  }).then(viewPricing => {
    if (viewPricing) {
      router.navigate(['/pricing']);
    }
  });

  return router.createUrlTree(['/']);
};
