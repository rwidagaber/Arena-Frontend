import { Component, inject, ViewEncapsulation, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '../../core/services/translation.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import emailjs from '@emailjs/browser';

@Component({
  selector: 'app-contact',
  imports: [RouterLink, RouterLinkActive, TranslateModule, ReactiveFormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  translationService = inject(TranslationService);
  private fb = inject(FormBuilder);

  isSending = signal(false);
  sendSuccess = signal(false);
  sendError = signal(false);

  contactForm: FormGroup = this.fb.group({
    name:    ['', [Validators.required]],
    email:   ['', [Validators.required, Validators.email]],
    phone:   ['', [Validators.required]],
    message: ['', [Validators.required]]
  });

  get isRtl(): boolean {
    return this.translationService.currentLang() === 'ar';
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    const minHeight = parseFloat(getComputedStyle(el).lineHeight) + 22;
    el.style.height = Math.max(el.scrollHeight, minHeight) + 'px';
  }

  async onSubmit() {
    console.log('onSubmit called. Form valid?', this.contactForm.valid, 'Errors:', this.contactForm.errors, this.contactForm.value);

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      console.log('Form is INVALID, stopping here. Field errors:',
        Object.keys(this.contactForm.controls).reduce((acc, key) => {
          acc[key] = this.contactForm.get(key)?.errors;
          return acc;
        }, {} as any)
      );
      return;
    }

    this.isSending.set(true);
    this.sendSuccess.set(false);
    this.sendError.set(false);

    try {
      await emailjs.send(
        'service_zv7xueg',
        'template_61h842k',
        {
          name:    this.contactForm.value.name,
          email:   this.contactForm.value.email,
          phone:   this.contactForm.value.phone,
          message: this.contactForm.value.message,
        },
        'N37RZErd5D_JtcAIh'
      );
      this.sendSuccess.set(true);
      this.contactForm.reset();
    } catch (error) {
      console.error('EmailJS error:', error);
      this.sendError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }
}