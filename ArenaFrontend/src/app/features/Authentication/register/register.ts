import { Component, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, Validators,
  AbstractControl, ValidationErrors, ValidatorFn
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { strictEmailValidator } from '../../../shared/utils/validators/strict-email.validator';
import { strongPasswordValidator } from '../../../shared/utils/validators/password.validator';
import { minAgeValidator } from '../../../shared/utils/validators/min-age.validator';
import { phoneValidator } from '../../../shared/utils/validators/phoneValidator';
import { realisticBodyValidator } from '../../../shared/utils/validators/realisticBodyValidator';

export function passwordsMatch(): ValidatorFn {
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
export class RegisterComponent implements AfterViewInit {

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
      phoneNumber:     ['', [Validators.required, phoneValidator]],
      birthday:        ['', [Validators.required, minAgeValidator(16)]],
      email:           ['', [Validators.required, Validators.email, strictEmailValidator()]],
      password:        ['', [Validators.required, Validators.minLength(8), strongPasswordValidator()]],
      confirmPassword: ['', Validators.required],
      weight:          [null, [Validators.required, Validators.min(35),  Validators.max(180)]],
      height:          [null, [Validators.required, Validators.min(130), Validators.max(210)]],
      gender:       [null, Validators.required],

    },
    {
      validators: [passwordsMatch(), realisticBodyValidator()]
    }
  );

  // =========================
  // Lifecycle
  // =========================

  ngAfterViewInit(): void {
    const waitForGoogle = setInterval(() => {
      if (typeof (window as any).google !== 'undefined') {
        clearInterval(waitForGoogle);
        this.initGoogleButton();
      }
    }, 100);
  }

  private initGoogleButton(): void {
    (window as any).google.accounts.id.initialize({
      client_id: '656089986689-anh4euktf142is1dmbeqq9ovank82cjc.apps.googleusercontent.com',
      callback: (response: any) => this.handleGoogleResponse(response)
    });

    (window as any).google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 376
      }
    );
  }

  // =========================
  // Google Auth
  // =========================

  handleGoogleResponse(response: any): void {
  const idToken = response.credential;

  this.auth.googleLogin(idToken).subscribe({
    next: (res) => {
      if (res.isGoogleUser) {
        // يوزر جديد — وديه يكمل البروفايل
        this.router.navigate(['/complete-profile']);
      } else {
        // يوزر موجود — وديه الهوم
        this.router.navigate(['/home']);
      }
    },
    error: (err: Error) => this.serverError = err.message
  });
}
  // =========================
  // Form
  // =========================

 onSubmit(): void {
  if (this.form.invalid) { this.form.markAllAsTouched(); return; }
  this.loading = true;
  this.serverError = '';

  this.auth.register(this.form.getRawValue() as any).subscribe({
    next: (res) => {
      this.loading = false;
      this.router.navigate(['/confirm-email'], {
        queryParams: {
          userId: res.userId,
          email: this.form.value.email
        }
      });
    },
    error: (err: Error) => { this.loading = false; this.serverError = err.message; },
  });
}

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  get showMismatch(): boolean {
    return this.form.hasError('mismatch') &&
           (this.form.get('confirmPassword')?.dirty ?? false);
  }

  getError(field: string): string {
    const c = this.form.get(field)!;
    if (c.hasError('required'))     return 'Required';
    if (c.hasError('weakPassword')) return 'Password must include uppercase, lowercase, number, and special character';
    if (c.hasError('minlength'))    return `Min ${c.errors?.['minlength'].requiredLength} chars`;
    if (c.hasError('invalidEmail')) return 'Invalid email format';
    if (c.hasError('minAge'))       return `You must be at least ${c.errors?.['minAge'].requiredAge} years old`;
    if (c.hasError('invalidPhone')) return 'Enter a valid phone number (10-15 digits)';
    if (c.hasError('min'))          return `Minimum value is ${c.errors?.['min'].min}`;
    if (c.hasError('max'))          return `Maximum value is ${c.errors?.['max'].max}`;
    return '';
  }

  get bodyError(): string {
    if (this.form.hasError('unrealisticWeight')) return 'Weight must be between 35 and 180 kg';
    if (this.form.hasError('unrealisticHeight')) return 'Height must be between 130 and 210 cm';
    if (this.form.hasError('unrealisticBMI'))    return 'Weight and height combination is not realistic';
    return '';
  }
}