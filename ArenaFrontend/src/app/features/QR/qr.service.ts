import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingDto, QrDto, QrScanResultDto, ScanQrRequestDto } from './qr.model';

@Injectable({
  providedIn: 'root',
})
export class QrService {
  private baseUrl = `${environment.apiUrl}/qr`;
  private bookingUrl = `${environment.apiUrl}/Booking`;

  constructor(private http: HttpClient) {}

  generate(bookingId: string): Observable<QrDto> {
    return this.http.post<QrDto>(`${this.baseUrl}/generate/${bookingId}`, {});
  }

  scan(dto: ScanQrRequestDto): Observable<QrScanResultDto> {
    return this.http.post<QrScanResultDto>(`${this.baseUrl}/scan`, dto);
  }

  getBookings(memberProfileId: string): Observable<BookingDto[]> {
    return this.http.get<BookingDto[]>(`${this.bookingUrl}?memberProfileId=${memberProfileId}`);
  }
}
