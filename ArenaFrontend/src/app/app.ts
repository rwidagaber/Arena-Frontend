import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MemberProfileComponent } from './components/member-profile/member-profile';
import { HeaderComponent } from "./shared/header/header";
import {WorkoutPlan} from "./components/workout-plan/workout-plan"

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MemberProfileComponent, HeaderComponent, WorkoutPlan],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ArenaFrontend');
}
