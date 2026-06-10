import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembershipDetails, ActiveSubscription } from '../../../core/models/member';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-membership-section',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './membership-section.html',
  styleUrl: './membership-section.css',
})
export class MembershipSection {
  membership = input<MembershipDetails | null>(null);
  subscription = input<ActiveSubscription | null>(null);
  loading = input<boolean>(false);
}
