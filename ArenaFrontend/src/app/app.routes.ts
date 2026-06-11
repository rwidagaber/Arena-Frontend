import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { Home } from './features/home/home';
import { About } from './features/about/about';
import { guestGuard } from './core/guards/auth/guest-guard-guard';
import { CheckoutComponent } from './features/pricing/checkout/checkout.component';
import { MyPaymentsComponent } from './features/pricing/my-payments/my-payments.component';

import { roleGuard } from './core/guards/role/role-guard';
import { ConfirmEmailComponent } from './features/Authentication/confirm-email/confirm-email';
import { confirmEmailGuard } from './core/guards/auth/confirm-email-guard';
import { CompleteProfileComponent } from './features/Authentication/complete-profile/complete-profile';
import { authGuard } from './core/guards/auth/auth-guard';
import { ForgotPasswordComponent } from './features/Authentication/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/Authentication/reset-password/reset-password';
import { ProfileComponent } from './components/member-profile/member-profile';
import { subscriptionGuard } from './core/guards/subscription/subscription-guard';
export const routes: Routes = [
  {
    path: 'about',
    component: About,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Member'] }
  },
  {
    path: 'login',
    component: LoginComponent,
        canActivate: [guestGuard]
      
  },
  {
    path: 'register',
    component: RegisterComponent,
        canActivate: [guestGuard]

  },
   {
    path: 'confirm-email',  // ← ضيف ده
    component:  ConfirmEmailComponent,
    canActivate:[confirmEmailGuard]
  },
  {
  path: 'complete-profile',
  component: CompleteProfileComponent,
  canActivate: [authGuard] // لازم يكون logged in
},
{
  path: 'forgot-password',
  component: ForgotPasswordComponent,
  canActivate: [guestGuard]
},
{
  path: 'reset-password',
  component: ResetPasswordComponent,
  canActivate: [guestGuard]
},
   {
    path: 'home',
    component: Home
  },
  {
    path: 'checkout',
    component: CheckoutComponent
  },
  {
    path: 'my-payments',
    component: MyPaymentsComponent
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard, subscriptionGuard]
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];
