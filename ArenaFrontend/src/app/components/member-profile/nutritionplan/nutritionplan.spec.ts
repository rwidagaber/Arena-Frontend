import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Nutritionplan } from './nutritionplan';

describe('Nutritionplan', () => {
  let component: Nutritionplan;
  let fixture: ComponentFixture<Nutritionplan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Nutritionplan]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Nutritionplan);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
