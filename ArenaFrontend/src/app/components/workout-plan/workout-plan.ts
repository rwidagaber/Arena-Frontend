import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface WorkoutSession {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  sets: number;
  reps: string;
  weight: number;
  isPB?: boolean;
  completed?: boolean;
}

@Component({
  selector: 'app-workout-plan',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workout-plan.html',
  styleUrls: ['./workout-plan.css']
})
export class WorkoutPlan implements OnInit {
  workoutDays = ['Push Day', 'Pull Day', 'Legs', 'Cardio'];
  activeDay = 'Push Day';
  consistency = { percentage: 72, totalDays: 18 };

  workoutData: { [key: string]: WorkoutSession[] } = {
    'Push Day': [
      { id: '1', name: 'Barbell Bench Press', category: 'Chest', imageUrl: 'assets/images/Push.jpeg', sets: 4, reps: '6-8', weight: 100, isPB: true },
      { id: '2', name: 'Overhead Press', category: 'Shoulders', imageUrl: 'assets/images/Push.jpeg', sets: 3, reps: '8-10', weight: 50 }
    ],
    'Pull Day': [
      { id: '3', name: 'Weighted Pull-Ups', category: 'Back', imageUrl: 'assets/images/Pull .jpg', sets: 3, reps: '8-10', weight: 15 },
      { id: '4', name: 'Barbell Row', category: 'Back', imageUrl: 'assets/images/Pull .jpg', sets: 4, reps: '8-12', weight: 80, isPB: true }
    ],
    'Legs': [
      { id: '5', name: 'Barbell Squat', category: 'Quads', imageUrl: 'assets/images/Legs.jpg', sets: 5, reps: '5', weight: 120 },
      { id: '6', name: 'Romanian Deadlift', category: 'Hamstrings', imageUrl: 'assets/images/Legs.jpg', sets: 4, reps: '8-10', weight: 90 }
    ],
    'Cardio': [
      { id: '7', name: 'HIIT Sprints', category: 'Endurance', imageUrl: 'assets/images/Cardio.avif', sets: 10, reps: '30s', weight: 0 }
    ]
  };

  ngOnInit(): void {}
  get currentWorkouts(): WorkoutSession[] { return this.workoutData[this.activeDay] || []; }
  get dayImage(): string {
    const images: { [key: string]: string } = {
      'Push Day': 'assets/images/Push.jpeg',
      'Pull Day': 'assets/images/Pull .jpg',
      'Legs': 'assets/images/Legs.jpg',
      'Cardio': 'assets/images/Cardio.avif'
    };
    return images[this.activeDay];
  }
  toggleComplete(workout: WorkoutSession): void { workout.completed = !workout.completed; }
}