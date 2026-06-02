import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutPlan } from './workout-plan';

describe('WorkoutPlan', () => {
  let component: WorkoutPlan;
  let fixture: ComponentFixture<WorkoutPlan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutPlan]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutPlan);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
