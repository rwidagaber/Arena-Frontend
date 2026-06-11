// complete-profile.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { minAgeValidator } from '../../../shared/utils/validators/min-age.validator';
import { phoneValidator } from '../../../shared/utils/validators/phoneValidator';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complete-profile.html',
  styleUrl: './complete-profile.css'
})
export class CompleteProfileComponent {

  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  loading     = false;
  serverError = '';

  form = this.fb.group({
    phoneNumber:  ['', [Validators.required, phoneValidator]],
    dateOfBirth:  ['', [Validators.required, minAgeValidator(16)]],
    weight:       [null, [Validators.required, Validators.min(35), Validators.max(180)]],
    height:       [null, [Validators.required, Validators.min(130), Validators.max(210)]],
    gender:       [null, Validators.required],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.completeProfile(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field)!;
    return c.invalid && (c.dirty || c.touched);
  }
}