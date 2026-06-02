import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
goToSignup(): void {
  this.router.navigate(['/register']);
} 
 goToforgot(): void {
  this.router.navigate(['/forgot-password']);
}

  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  showPw      = false;
  loading     = false;
  serverError = '';

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loading = false;
        const ret = new URLSearchParams(window.location.search).get('returnUrl') ?? '/home';
        this.router.navigateByUrl(ret);
      },
      error: (err: Error) => { this.loading = false; this.serverError = err.message; },
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  getError(field: string): string {
    const c: AbstractControl = this.form.get(field)!;
    if (c.hasError('required'))   return 'This field is required';
    if (c.hasError('email'))      return 'Enter a valid email';
    if (c.hasError('minlength'))  return `Minimum ${c.errors?.['minlength'].requiredLength} characters`;
    return '';
  }
}