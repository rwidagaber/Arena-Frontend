// qr.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QrDto, QrScanResultDto, ScanQrRequestDto } from './qr.model';
import { environment } from '../../../environments/environment';  // ✅ add this

@Injectable({
  providedIn: 'root'
})
export class QrService {
  private baseUrl = `${environment.apiUrl}/qr`;  // ✅ was hardcoded to wrong port

  constructor(private http: HttpClient) {}

  generate(bookingId: string): Observable<QrDto> {
    return this.http.post<QrDto>(
      `${this.baseUrl}/generate/${bookingId}`,
      {}
    );
  }

  scan(dto: ScanQrRequestDto): Observable<QrScanResultDto> {
    return this.http.post<QrScanResultDto>(
      `${this.baseUrl}/scan`, dto
    );
  }
}