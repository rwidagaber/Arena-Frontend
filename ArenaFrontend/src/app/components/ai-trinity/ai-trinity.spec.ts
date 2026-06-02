import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiTrinity } from './ai-trinity';

describe('AiTrinity', () => {
  let component: AiTrinity;
  let fixture: ComponentFixture<AiTrinity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiTrinity]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiTrinity);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
