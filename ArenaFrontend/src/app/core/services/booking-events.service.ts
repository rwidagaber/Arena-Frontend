import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BookingEventsService {
  private readonly bookingsChangedSubject = new Subject<void>();
  readonly bookingsChanged$ = this.bookingsChangedSubject.asObservable();

  notifyBookingsChanged(): void {
    this.bookingsChangedSubject.next();
  }
}
