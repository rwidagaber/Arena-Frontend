import { AbstractControl, ValidationErrors } from '@angular/forms';

export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (!value) return null;

  const regex = /^\+?[0-9]{10,15}$/;

  return regex.test(value)
    ? null
    : { invalidPhone: true };
}