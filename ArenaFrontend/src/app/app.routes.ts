import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProfileComponent } from './components/member-profile/member-profile';
import { subGuard } from './core/guards/auth/sub-guard';

export const routes: Routes = [
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
    component: DashboardComponent,
    canActivate: [subGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [subGuard]
  },
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full'
  }
];
