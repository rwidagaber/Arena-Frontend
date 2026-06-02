import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientDahboard } from './client-dahboard';

describe('ClientDahboard', () => {
  let component: ClientDahboard;
  let fixture: ComponentFixture<ClientDahboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDahboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientDahboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
