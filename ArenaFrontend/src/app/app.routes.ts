import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { ProfileComponent } from './components/member-profile/member-profile';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth/auth-guard';
import { subGuard } from './core/guards/auth/sub-guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
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
    component: ProfileComponent,
    canActivate: [authGuard, subGuard]
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
