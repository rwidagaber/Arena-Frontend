import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-dahboard.html',
  styleUrls: ['./client-dahboard.css'] // Or point to dashboard.css depending on your file name
})
export class ClientDahboard {
  // Fixes the missing property error from image_566c0c.png
  @Input() profileData: any; 

  // Fixes the event type assignment issue
  @Output() changeTab = new EventEmitter<string>(); 

  triggerTabChange(tabName: string): void {
    this.changeTab.emit(tabName);
  }
}