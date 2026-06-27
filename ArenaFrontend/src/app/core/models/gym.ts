/** A single day's opening hours as returned by GET /api/working-hours.
 *  Times are "HH:mm:ss" (24h). `closeTime` may be earlier than `openTime`,
 *  meaning the gym closes after midnight (e.g. 08:00 → 03:00). */
export interface WorkingHoursDay {
  id?: number;
  dayOfWeek: number;        // 0 = Sunday … 6 = Saturday
  openTime: string | null;  // e.g. "08:00:00"
  closeTime: string | null; // e.g. "03:00:00"
  isClosed?: boolean;
}
