import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, Validators,
  AbstractControl, ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { strictEmailValidator } from '../../../shared/utils/validators/strict-email.validator';
import { strongPasswordValidator } from '../../../shared/utils/validators/password.validator';
import { minAgeValidator } from '../../../shared/utils/validators/min-age.validator';
import { phoneValidator } from '../../../shared/utils/validators/phoneValidator';

export function passwordsMatch(): ValidationErrors | null {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw = group.get('password')?.value;
    const cpw = group.get('confirmPassword')?.value;

    if (!pw || !cpw) return null;

    return pw === cpw ? null : { mismatch: true };
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'

})
export class RegisterComponent {
goToLogin(): void {
  this.router.navigate(['/login']);
}
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  showPw      = false;
  loading     = false;
  serverError = '';

  form = this.fb.group(
    {
      firstName:       ['', Validators.required],
      lastName:        ['', Validators.required],
phoneNumber: [
  '',
  [
    Validators.required,
    phoneValidator
  ]
],birthday: [
  '',
  [
    Validators.required,
    minAgeValidator(16)
  ]
],      email:           ['', [Validators.required, Validators.email, strictEmailValidator()]],
password: [
  '',
  [
    Validators.required,
    Validators.minLength(8),
    strongPasswordValidator()
  ]
],      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch() },
  );

  get showMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           (this.form.get('confirmPassword')?.dirty ?? false);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.register(this.form.getRawValue() as any).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/home']); },
      error: (err: Error) => { this.loading = false; this.serverError = err.message; },
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

 getError(field: string): string {
  const c = this.form.get(field)!;

  if (c.hasError('required')) return 'Required';

  if (c.hasError('weakPassword'))
    return 'Password must include uppercase, lowercase, number, and special character';

  if (c.hasError('minlength'))
    return `Min ${c.errors?.['minlength'].requiredLength} chars`;

  if (c.hasError('invalidEmail'))
    return 'Invalid email format';

 if (c.hasError('minAge')) {
    return `You must be at least ${c.errors?.['minAge'].requiredAge} years old`;
  }  ;
  if (c.hasError('invalidPhone')) {
  return 'Enter a valid phone number (10-15 digits)';
};
  return '';
}
}