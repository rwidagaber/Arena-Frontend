import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientDahboard } from '../client-dahboard/client-dahboard';
import { AiTrinity } from '../ai-trinity/ai-trinity';
import { WorkoutPlan } from '../workout-plan/workout-plan';
import { MealPlan } from '../meal-plan/meal-plan';

@Component({
  selector: 'app-member-profile',
  standalone: true,
  imports: [
    CommonModule,
    ClientDahboard,     
    AiTrinity,   
    WorkoutPlan, 
    MealPlan     
  ],
  templateUrl: './member-profile.html',
  styleUrl: './member-profile.css'
})
export class MemberProfileComponent implements OnInit {
  activeTab: string = 'dashboard';
  
  // Set to true to showcase the Horizontal Navigation Hub; change to false to view public locking
  isLoggedIn: boolean = true; 
  
  memberProfile = {
    name: 'Wael Mahmoud',
    subscription: {
      remainingSessions: 18,
      totalSessions: 24
    }
  };

  ngOnInit(): void {}

  setTab(tabName: string): void {
    this.activeTab = tabName;
  }
}