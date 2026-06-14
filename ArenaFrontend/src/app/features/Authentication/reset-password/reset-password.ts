// reset-password.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import {strongPasswordValidator } from '../../../shared/utils/validators/password.validator';
export function passwordsMatch(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw  = group.get('newPassword')?.value;
    const cpw = group.get('confirmNewPassword')?.value;
    if (!pw || !cpw) return null;
    return pw === cpw ? null : { mismatch: true };
  };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit {

  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  loading     = false;
  serverError = '';
  success     = false;
  showPw      = false;

  email = '';
  token = '';

  form = this.fb.group({
    newPassword:        ['', [Validators.required, Validators.minLength(8), strongPasswordValidator()]],
    confirmNewPassword: ['', Validators.required]
  }, { validators: passwordsMatch() });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';

      console.log('resetPasswordGuard:', { token: this.token, email: this.email, isLoggedIn: this.auth.isLoggedIn });
    

    if (!this.token || !this.email) {
      this.router.navigate(['/forgot-password']);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.resetPassword({
      email:              this.email,
      token:              this.token,
      newPassword:        this.form.value.newPassword!,
      confirmNewPassword: this.form.value.confirmNewPassword!
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  get showMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           (this.form.get('confirmNewPassword')?.dirty ?? false);
  }
}