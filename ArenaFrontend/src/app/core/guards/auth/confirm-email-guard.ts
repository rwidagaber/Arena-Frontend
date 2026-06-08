
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const confirmEmailGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  const userId = route.queryParamMap.get('userId');
  const email  = route.queryParamMap.get('email');

  // لو مفيش userId أو email في الـ URL → مش هيعدي
  if (!userId || !email) {
    router.navigate(['/register']);
    return false;
  }

  return true;
};