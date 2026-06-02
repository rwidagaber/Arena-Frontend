import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-profile.html',
  styleUrls: ['./member-profile.css']
})
export class ProfileComponent implements OnInit {
  
  currentSteps = 12400;
  goalSteps = 15000;

  constructor() {}

  ngOnInit(): void {
    this.apiGetProfileData();
    this.apiGetActivityHistory();
  }

  apiGetProfileData(): void {
    // Later add Logic to fetch user stats, personal info, and class schedules
    console.log('Fetching profile data...');
  }

  //Later Add Logic
  apiGetActivityHistory(): void {
    console.log('Fetching recent activity...');
  }
}