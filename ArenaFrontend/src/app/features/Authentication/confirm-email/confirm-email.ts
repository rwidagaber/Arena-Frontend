import { Component, inject, OnInit, AfterViewInit, OnDestroy, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../../../core/services/translation.service';
import { ThemeService } from '../../../core/services/themeservice';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './confirm-email.html',
  styleUrl: './confirm-email.css'
})
export class ConfirmEmailComponent implements OnInit, AfterViewInit, OnDestroy {

  private fb        = inject(FormBuilder);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private route     = inject(ActivatedRoute);
  readonly t        = inject(TranslationService);
  readonly themeService = inject(ThemeService);
  private translate = inject(TranslateService);

  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  userId      = '';
  email       = '';
  loading     = false;
  serverError = '';
  resendCooldown = 0;

  private _cooldownInterval: any;
  private langSub?: Subscription;

  get currentLang() { return this.t.currentLang(); }
  get isRtl() { return this.currentLang === 'ar'; }

  form = this.fb.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  ngOnInit(): void {
    this.userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
    this.email  = this.route.snapshot.queryParamMap.get('email')  ?? '';
    this.langSub = this.translate.onLangChange.subscribe(() => {});
  }

  ngAfterViewInit(): void {
    this.otpBoxes.first?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    clearInterval(this._cooldownInterval);
    this.langSub?.unsubscribe();
  }

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

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.serverError = '';

    this.auth.confirmEmail(this.userId, this.form.value.otp!).subscribe({
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

  onResendCode(): void {
    if (!this.userId || this.resendCooldown > 0) return;
    this.loading = true;
    this.serverError = '';

    this.auth.resendConfirmation(this.userId).subscribe({
      next: () => {
        this.loading = false;
        this._startCooldown(120);
      },
      error: (err: Error) => {
        this.loading = false;
        this.serverError = err.message;
      }
    });
  }

  private _startCooldown(seconds: number): void {
    this.resendCooldown = seconds;
    this._cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this._cooldownInterval);
    }, 1000);
  }
}