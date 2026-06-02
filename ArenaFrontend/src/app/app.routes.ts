import { Routes } from '@angular/router';
import { RegisterComponent } from './features/Authentication/register/register';
import { LoginComponent } from './features/Authentication/login/login';

export const routes: Routes = [
     {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  // {
  //   path: '',
  //   redirectTo: 'login',
  //   pathMatch: 'full'
  // }
];
