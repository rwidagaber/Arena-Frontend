import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { ProfileComponent } from './components/member-profile/member-profile';
import { Home } from './features/home/home';
import { About } from './features/about/about';
import { CheckoutComponent } from './features/pricing/checkout/checkout.component';
import { MyPaymentsComponent } from './features/pricing/my-payments/my-payments.component';
import { ConfirmEmailComponent } from './features/Authentication/confirm-email/confirm-email';
import { CompleteProfileComponent } from './features/Authentication/complete-profile/complete-profile';
import { ForgotPasswordComponent } from './features/Authentication/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/Authentication/reset-password/reset-password';

// Guards
import { authGuard } from './core/guards/auth/auth-guard';
import { subGuard } from './core/guards/auth/sub-guard';
import { guestGuard } from './core/guards/auth/guest-guard-guard';
import { roleGuard } from './core/guards/role/role-guard';
import { confirmEmailGuard } from './core/guards/auth/confirm-email-guard';
export const routes: Routes = [
  // Base / Home Routes
  {
    path: '',
    component: Home,
    pathMatch: 'full'
  },
  
  // About Route (Kept the Main branch protected version, remove if you want the redirect instead)
  {
    path: 'about',
    component: About,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Member'] }
  },

  // Authentication Routes
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
    path: 'confirm-email',
    component: ConfirmEmailComponent,
    canActivate: [confirmEmailGuard]
  },
  {
    path: 'complete-profile',
    component: CompleteProfileComponent,
    canActivate: [authGuard]
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

  // Feature Routes
  {
    path: 'checkout',
    component: CheckoutComponent
  },
  {
    path: 'dashboard',
    component: ProfileComponent,
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'my-payments',
    component: MyPaymentsComponent
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'contact',
    redirectTo: '/'
  }
];