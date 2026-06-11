import { Component, inject, OnInit, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './confirm-email.html',
  styleUrl: './confirm-email.css'
})
export class ConfirmEmailComponent implements OnInit, AfterViewInit {

  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  userId      = '';
  email       = '';
  loading     = false;
  serverError = '';

  form = this.fb.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  // =========================
  // Lifecycle
  // =========================

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    this.email  = this.route.snapshot.queryParamMap.get('email')  ?? '';
  }

  ngAfterViewInit(): void {
    this.otpBoxes.first?.nativeElement.focus();
  }

  // =========================
  // OTP Boxes Logic
  // =========================

  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');
    input.value = value;

    if (value && index < 5) {
      this.otpBoxes.toArray()[index + 1].nativeElement.focus();
    }

    this.updateOtpValue();
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.otpBoxes.toArray()[index - 1].nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/[^0-9]/g, '').slice(0, 6) ?? '';

    const boxes = this.otpBoxes.toArray();
    pasted.split('').forEach((char, i) => {
      if (boxes[i]) boxes[i].nativeElement.value = char;
    });

    const lastIndex = Math.min(pasted.length, 5);
    boxes[lastIndex].nativeElement.focus();

    this.updateOtpValue();
  }

  private updateOtpValue(): void {
    const otp = this.otpBoxes.toArray()
      .map(box => box.nativeElement.value)
      .join('');

    this.form.get('otp')!.setValue(otp);
    this.form.get('otp')!.markAsTouched();
  }

  // =========================
  // Submit
  // =========================

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    const otp = this.form.value.otp!;

    this.auth.confirmEmail(this.userId, otp).subscribe({
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

  // =========================
  // Resend
  // =========================

  onResendCode(): void {
    if (!this.email) return;
    this.loading = true;
    this.serverError = '';

    this.auth.forgotPassword({ email: this.email }).subscribe({
      next: () => { this.loading = false; },
      error: (err: Error) => { this.loading = false; this.serverError = err.message; }
    });
  }
}