import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { Home } from './features/home/home';
import { About } from './features/about/about';
import { guestGuard } from './core/guards/auth/guest-guard-guard';
import { CheckoutComponent } from './features/pricing/checkout/checkout.component';
import { MyPaymentsComponent } from './features/pricing/my-payments/my-payments.component';

import { authGuard } from './core/guards/auth/auth-guard';
import { roleGuard } from './core/guards/role/role-guard';

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
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];
