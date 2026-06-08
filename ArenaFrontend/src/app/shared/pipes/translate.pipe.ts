import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private service = inject(TranslationService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.service.translate(key, params);
  }
}
