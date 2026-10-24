// Time rules for the whole server (NFR-13).
//
// 1. Calendar dates (admissionDate, dischargeDate, dateOfBirth, scheduledDate, completedDate)
//    are stored as midnight UTC of that date, e.g. 6 Oct 2026 -> 2026-10-06T00:00:00Z.
//    They mean "a day", not "an instant", so they are never shifted by time zones.
// 2. Instants (scheduledAt, recordedAt, reportedAt, createdAt ...) are real UTC moments.
// 3. "Today" and dose clock times are Indian Standard Time. IST is UTC+05:30 all year
//    (India has no daylight saving), so a fixed offset is exact.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
export const IST_OFFSET_MINUTES = 330;

// Decision D4: fixed clock time for each timing slot (IST).
export const SLOT_TIMES = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
};

/** 'YYYY-MM-DD' -> calendar date (midnight UTC). Returns null for anything invalid. */
export function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects dates like 2026-02-30, which JavaScript would silently roll over.
  return date.toISOString().startsWith(value) ? date : null;
}

/** The IST calendar date that contains the instant `now`. */
export function istToday(now = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * MINUTE);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY);
}

/** Whole days from calendar date `from` to calendar date `to`. */
export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

/** The instant at which an IST clock time ('HH:mm') happens on a calendar date. */
export function atIstTime(date, hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(date.getTime() + (hours * 60 + minutes - IST_OFFSET_MINUTES) * MINUTE);
}

/** Start (inclusive) and end (exclusive) instants of an IST calendar day. */
export function istDayRange(date) {
  const start = atIstTime(date, '00:00');
  return { start, end: new Date(start.getTime() + DAY) };
}

export function addMinutes(instant, minutes) {
  return new Date(instant.getTime() + minutes * MINUTE);
}
