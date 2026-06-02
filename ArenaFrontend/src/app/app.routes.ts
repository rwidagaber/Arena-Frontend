import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';
import { Home } from './features/home/home';

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
    path: 'home',
    component: Home
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];
