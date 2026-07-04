import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const resetPasswordGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  // لازم يكون جاي بـ token و email في الـ URL بس
  // (الباك إند هو المسؤول عن التحقق من صحة الـ token فعليًا،
  // مفيش داعي نمنع اليوزر لمجرد إنه logged in بجلسة قديمة)
  const token = route.queryParamMap.get('token');
  const email = route.queryParamMap.get('email');
  if (!token || !email) {
    router.navigate(['/forgot-password']);
    return false;
  }

  return true;
};