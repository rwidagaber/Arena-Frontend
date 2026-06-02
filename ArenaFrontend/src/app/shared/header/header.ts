import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class HeaderComponent {
  private readonly router = inject(Router);

  @Input() isLoggedIn: boolean = false;
  @Input() activeTab: string = 'home';
  @Output() tabChange = new EventEmitter<string>();

  navigateToTab(tabName: string, event: Event): void {
    event.preventDefault();
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
    if (tabName === 'home') {
      this.router.navigate(['/']);
    }
  }
}