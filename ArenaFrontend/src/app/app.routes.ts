import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { ProfileComponent } from './components/member-profile/member-profile';
import { subGuard } from './core/guards/auth/sub-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'dashboard',
    component: ProfileComponent
  },
  {
    path: 'about',
    redirectTo: '/',
    pathMatch: 'full'
  },
  {
    path: 'contact',
    redirectTo: '/',
    pathMatch: 'full'
  }
];
