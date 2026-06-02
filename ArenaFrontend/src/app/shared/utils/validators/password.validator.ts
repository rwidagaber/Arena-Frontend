import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function strongPasswordValidator(): ValidatorFn {
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) return null;

    return regex.test(value)
      ? null
      : { weakPassword: true };
  };
}