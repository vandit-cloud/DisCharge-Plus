// Display helpers. Calendar dates arrive as midnight UTC and are shown in UTC (so they never
// shift a day); instants are shown in Indian Standard Time. See server/src/utils/time.js.
const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };
const IST = 'Asia/Kolkata';
const locale = (lng) => LOCALES[lng] ?? 'en-IN';

export function formatDate(iso, lng = 'en', options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return iso ? new Intl.DateTimeFormat(locale(lng), { ...options, timeZone: 'UTC' }).format(new Date(iso)) : '';
}

export function formatDay(iso, lng = 'en') {
  return formatDate(iso, lng, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTime(iso, lng = 'en') {
  return iso ? new Intl.DateTimeFormat(locale(lng), { hour: 'numeric', minute: '2-digit', timeZone: IST }).format(new Date(iso)) : '';
}

export function formatDateTime(iso, lng = 'en') {
  return iso
    ? new Intl.DateTimeFormat(locale(lng), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST }).format(new Date(iso))
    : '';
}

/** "4 min ago", "3 h ago", "2 d ago" (clinician pages). */
export function timeAgo(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** The IST calendar date (YYYY-MM-DD) of an instant. */
export function istDateOf(instant) {
  return new Date(new Date(instant).getTime() + 330 * 60000).toISOString().slice(0, 10);
}

/** Today's IST calendar date as YYYY-MM-DD. */
export function istTodayISO(now = new Date()) {
  return istDateOf(now);
}

export function addDaysISO(isoDate, days) {
  return new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** Minutes since midnight IST, for the sun-path marker. */
export function istMinutesNow(now = new Date()) {
  const shifted = new Date(now.getTime() + 330 * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** +919876543210 -> +91 98765 43210 */
export function formatPhone(phone) {
  return phone?.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2') ?? '';
}

export function medicineName(medication) {
  if (!medication) return '';
  const name = medication.genericName.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  return `${name} ${medication.strength}`;
}

// Colour + icon + text together: colour is never the only signal (NFR-11).
export const TIER_STYLE = {
  self_care: { icon: '🏠', text: 'text-neem', bg: 'bg-neem-soft', solid: 'bg-neem', stripe: 'border-l-neem' },
  teleconsult: { icon: '📞', text: 'text-amber', bg: 'bg-amber-soft', solid: 'bg-amber', stripe: 'border-l-amber' },
  urgent: { icon: '⚠️', text: 'text-clay', bg: 'bg-clay-soft', solid: 'bg-clay', stripe: 'border-l-clay' },
  emergency: { icon: '🚑', text: 'text-kumkum', bg: 'bg-kumkum-soft', solid: 'bg-kumkum', stripe: 'border-l-kumkum' },
};

export const RISK_STYLE = {
  high: { label: 'High', text: 'text-kumkum', bg: 'bg-kumkum-soft', solid: 'bg-kumkum' },
  moderate: { label: 'Moderate', text: 'text-amber', bg: 'bg-amber-soft', solid: 'bg-amber' },
  low: { label: 'Low', text: 'text-neem', bg: 'bg-neem-soft', solid: 'bg-neem' },
};

export const SYMPTOM_ICON = {
  CHEST_PAIN: '💔',
  BREATHLESS: '🫁',
  SWELLING_LEGS: '🦵',
  DIZZY: '😵‍💫',
  FAINTING: '😵',
  CONFUSION: '❓',
  FEVER: '🤒',
  VOMITING: '🤮',
  SHAKY_SWEATY: '😰',
  EXTREME_THIRST: '🥤',
  LOW_URINE: '🚽',
  WOUND_PROBLEM: '🩹',
};

export const SLOT_ICON = { morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙' };
export const SLOTS = ['morning', 'afternoon', 'evening', 'night'];

export const FOLLOW_UP_ICON = { in_person: '🏥', teleconsult: '💻', lab_test: '🧪', phone_check: '📞' };

export const PROTOCOL_LABEL = {
  cardiac: 'Cardiac',
  diabetes: 'Diabetes',
  ckd: 'Chronic kidney disease',
  post_surgical: 'Post-surgical',
  general: 'General',
};
