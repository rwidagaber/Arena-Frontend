import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingDto, CreateBookingDto } from '../models/booking';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private apiUrl = `${environment.apiUrl}/Booking`;

  constructor(private http: HttpClient) {}

  getBookings(memberProfileId: string): Observable<BookingDto[]> {
    return this.http.get<BookingDto[]>(`${this.apiUrl}?memberProfileId=${memberProfileId}`);
  }

  createBooking(dto: CreateBookingDto): Observable<BookingDto> {
    return this.http.post<BookingDto>(`${this.apiUrl}/create`, dto);
  }

  cancelBooking(bookingId: string): Observable<BookingDto> {
    return this.http.post<BookingDto>(`${this.apiUrl}/cancel/${bookingId}`, {});
  }
}
