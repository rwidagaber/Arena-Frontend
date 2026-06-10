import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembershipDetails, ActiveSubscription } from '../../../core/models/member';

@Component({
  selector: 'app-membership-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './membership-section.html',
  styleUrl: './membership-section.css',
})
export class MembershipSection {
  membership = input<MembershipDetails | null>(null);
  subscription = input<ActiveSubscription | null>(null);
  loading = input<boolean>(false);
}
