import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { ProfileComponent } from './components/member-profile/member-profile';
import { Home } from './features/home/home';
import { About } from './features/about/about';
import { CheckoutComponent } from './features/pricing/checkout/checkout.component';
import { MyPaymentsComponent } from './features/pricing/my-payments/my-payments.component';
import { PricingComponent } from './features/pricing/pricing.component';
import { ConfirmEmailComponent } from './features/Authentication/confirm-email/confirm-email';
import { CompleteProfileComponent } from './features/Authentication/complete-profile/complete-profile';
import { ForgotPasswordComponent } from './features/Authentication/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/Authentication/reset-password/reset-password';
import { ChatComponent } from './features/chat/chat.component';

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
    component: Home,
    pathMatch: 'full'
  },

  // ─── Authentication (guests only) ───
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard] ,
      data: { hideLayout: true }
     
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [guestGuard] ,
      data: { hideLayout: true }
        
  },
  {
    path: 'forgot-password',
      component: ForgotPasswordComponent,
      canActivate: [guestGuard] ,
        data: { hideLayout: true }

  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [resetPasswordGuard] ,
      data: { hideLayout: true }

  },
  {
    path: 'confirm-email',
    component: ConfirmEmailComponent,
    canActivate: [confirmEmailGuard]  ,
      data: { hideLayout: true }

  },
  {
    path: 'complete-profile',
    component: CompleteProfileComponent,
    canActivate: [completeProfileGuard] ,
      data: { hideLayout: true }

  },

  // ─── Protected (members only) ───
  {
    path: 'pricing',
    component: PricingComponent
  },
  {
    path: 'dashboard',
    component: ProfileComponent,
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard, subGuard]
  },
  {
    path: 'about',
    component: About,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Member'] }
  },
  {
    path: 'chat',
    component: ChatComponent,
    canActivate: [authGuard, subscriptionGuard]
  },

  // ─── Semi-protected ───
  {
    path: 'checkout',
    component: CheckoutComponent       // بدون guard - عشان يشتري
  },
  {
    path: 'my-payments',
    component: MyPaymentsComponent     // ✅ ممكن تضيف authGuard لو محتاج
  },

  // ─── Redirects ───
  {
    path: 'contact',
    redirectTo: ''
  },
  {
    path: '**',
    redirectTo: ''                     // ✅ أي route غلط → home
  }
];