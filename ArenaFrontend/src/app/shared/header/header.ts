import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  @Input() isLoggedIn: boolean = false;
  @Input() activeTab: string = 'dashboard';
  @Output() tabChange = new EventEmitter<string>();

  // Additional outputs to communicate actions back to the app controller logic
  @Output() loginRequested = new EventEmitter<void>();
  @Output() signUpRequested = new EventEmitter<void>();

  navigateToTab(tabName: string, event: Event): void {
    event.preventDefault();
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
  }

  onLoginClick(event: Event): void {
    event.preventDefault();
    this.loginRequested.emit();
  }

  onSignUpClick(): void {
    this.signUpRequested.emit();
  }
}