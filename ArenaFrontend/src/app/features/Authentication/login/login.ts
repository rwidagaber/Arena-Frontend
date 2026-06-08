import { Component, inject, AfterViewInit } from '@angular/core';
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
export class LoginComponent implements AfterViewInit {

  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  showPw      = false;
  loading     = false;
  serverError = '';

  form = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false]
  });

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
        text: 'signin_with',
        width: 376
      }
    );
  }

  // =========================
  // Google Auth
  // =========================

  handleGoogleResponse(response: any): void {
    const idToken = response.credential;
    this.loading = true;
    this.serverError = '';

    this.auth.googleLogin(idToken).subscribe({
      next: (res) => {
        if (res.isGoogleUser) {
          this.loading = false;
          this.router.navigate(['/complete-profile']);
        } else {
          this.auth.getMe().subscribe(() => {
            this.loading = false;
            const ret = new URLSearchParams(window.location.search).get('returnUrl') ?? '/home';
            this.router.navigateByUrl(ret);
          });
        }
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  // =========================
  // Form Submission
  // =========================

  onSubmit(): void {
    if (this.form.invalid) { 
      this.form.markAllAsTouched(); 
      return; 
    }
    
    this.loading = true;
    this.serverError = '';

    // Fixed: Pulling values directly and using type assertions safely
    const formValues = this.form.getRawValue();
    const rememberMe = formValues.rememberMe ?? false;
    
    const loginDto = {
      email: formValues.email ?? '',
      password: formValues.password ?? '',
      RememberMe: rememberMe
    };

    this.auth.login(loginDto).subscribe({
      next: () => {
        this.auth.getMe().subscribe({
          next: () => {
            this.loading = false;
            const ret = new URLSearchParams(window.location.search).get('returnUrl') ?? '/home';
            this.router.navigateByUrl(ret);
          },
          error: (profileErr: Error) => {
            this.loading = false;
            this.serverError = profileErr.message;
          }
        });
      },
      error: (err: Error) => { 
        this.loading = false; 
        this.serverError = err.message; 
      },
    });
  }

  // =========================
  // Navigation & Helpers
  // =========================

  goToSignup(): void {
    this.router.navigate(['/register']);
  }

  goToforgot(): void {
    this.router.navigate(['/forgot-password']);
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }

  getError(field: string): string {
    const c: AbstractControl = this.form.get(field)!;
    if (c.hasError('required'))  return 'This field is required';
    if (c.hasError('email'))     return 'Enter a valid email';
    if (c.hasError('minlength')) return `Minimum ${c.errors?.['minlength'].requiredLength} characters`;
    return '';
  }
}