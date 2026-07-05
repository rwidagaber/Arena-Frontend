import { Routes } from '@angular/router';

// Guards
import { authGuard } from './core/guards/auth/auth-guard';
import { subGuard } from './core/guards/auth/sub-guard';
import { guestGuard } from './core/guards/auth/guest-guard-guard';
import { roleGuard } from './core/guards/role/role-guard';
import { confirmEmailGuard } from './core/guards/auth/confirm-email-guard';
import { completeProfileGuard } from './core/guards/auth/complete-profile-guard';
import { resetPasswordGuard } from './core/guards/auth/reset-password-guard';
import { subscriptionGuard } from './core/guards/subscription/subscription-guard';

export const routes: Routes = [
  // ─── Public ───
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
    pathMatch: 'full'
  },
  {
    path: 'plans',
    loadComponent: () => import('./features/pricing/pricing.component').then(m => m.PricingComponent)
  },

  // ─── Authentication (guests only) ───
  {
    path: 'login',
    loadComponent: () => import('./features/Authentication/login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    data: { hideLayout: true }
  },
  {
    path: 'register',
    loadComponent: () => import('./features/Authentication/register/register').then(m => m.RegisterComponent),
    canActivate: [guestGuard],
    data: { hideLayout: true }
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/Authentication/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
    data: { hideLayout: true }
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/Authentication/reset-password/reset-password').then(m => m.ResetPasswordComponent),
    canActivate: [resetPasswordGuard],
    data: { hideLayout: true }
  },
  {
    path: 'confirm-email',
    loadComponent: () => import('./features/Authentication/confirm-email/confirm-email').then(m => m.ConfirmEmailComponent),
    canActivate: [confirmEmailGuard],
    data: { hideLayout: true }
  },
  {
    path: 'complete-profile',
    loadComponent: () => import('./features/Authentication/complete-profile/complete-profile').then(m => m.CompleteProfileComponent),
    canActivate: [completeProfileGuard],
    data: { hideLayout: true }
  },

  // ─── Protected (members only) ───
  {
    path: 'dashboard',
    loadComponent: () => import('./components/member-profile/member-profile').then(m => m.ProfileComponent),
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./components/member-profile/member-profile').then(m => m.ProfileComponent),
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then(m => m.About),
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent),
    canActivate: [authGuard, subscriptionGuard],
    data: { hideFooter: true }
  },
  {
    path: 'notifications',
    loadComponent: () => import('./features/notifications/notification/notification').then(m => m.Notification),
    canActivate: [authGuard],
    data: { hideFooter: true }
  },

  // ─── Semi-protected ───
  {
    path: 'checkout',
    loadComponent: () => import('./features/pricing/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'my-payments',
    loadComponent: () => import('./features/pricing/my-payments/my-payments.component').then(m => m.MyPaymentsComponent)
  },
  {
    path: 'working-hours',
    loadComponent: () =>
      import('./features/working-hours/working-hours.component').then(
        (m) => m.WorkingHoursComponent
      ),
  },

  // ─── QR ───
  {
    path: 'qr/:bookingId',
    loadComponent: () => import('./features/QR/qr-display.component/qr-display.component').then(m => m.QrDisplayComponent),
    canActivate: [authGuard, subGuard]
  },

  {
    path: 'contact',
    loadComponent: () => import('./features/contact/contact').then(m => m.Contact)
  },
  {
    path: '**',
    redirectTo: ''                     // ✅ أي route غلط → home
  }
];
