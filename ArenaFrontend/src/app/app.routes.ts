import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { Home } from './features/home/home';
import { guestGuard } from './core/guards/auth/guest-guard-guard';

export const routes: Routes = [
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
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];
