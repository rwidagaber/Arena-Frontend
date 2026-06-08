// forgot-password.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPasswordComponent {

  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  loading     = false;
  serverError = '';
  success     = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.forgotPassword({ email: this.form.value.email! }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}