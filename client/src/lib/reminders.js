// Dose reminders as phone notifications. Only the Android app (Capacitor) schedules them; on the
// website every function here does nothing. The phone sets its own alarms from the doses it has
// already downloaded, so a reminder still fires with no signal. Missed-dose escalation stays on the
// server (the cron sweep): the phone reminds, the server is the safety net.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isApp = Capacitor.isNativePlatform();

/**
 * Android notification ids must be 32-bit integers, so derive one from the dose's adherenceId
 * (a 24-hex-digit MongoDB ObjectId). The last 7 hex digits are the ObjectId's counter, unique per
 * dose. `nudge` lets you give a second reminder for the same dose its own id (0 = first, 1 = second).
 */
export function reminderId(adherenceId, nudge = 0) {
  return parseInt(adherenceId.slice(-7), 16) * 4 + nudge;
}

/**
 * Decide which reminders to set. Pure function: no phone APIs, so it is easy to reason about and test.
 *
 * @param doses  today's and tomorrow's doses from GET /patients/:id/doses. Each dose has:
 *               adherenceId, scheduledAt (ISO string), status ('pending' | 'taken' | 'missed'),
 *               slot ('morning' | 'afternoon' | 'evening' | 'night'),
 *               prescription.isCritical, prescription.dosage, prescription.medication.genericName
 * @param t      i18next translate function, so reminders use the patient's language:
 *               t('reminder.title', { slot: t('slot.morning') })  -> "Morning medicines: time to take them"
 *               t('reminder.body', { medicines: 'furosemide, metformin' })
 *                                                                 -> "Take furosemide, metformin and mark it in the app"
 *               t('reminder.critical')                            -> "Important: please don't miss this one"
 *               t('reminder.nudge', { slot: t('slot.morning') })  -> "Morning: medicines not marked yet"
 * @param now    current time (a parameter so the function is testable)
 * @returns      array of { id, at: Date, title, body }. Return [] to set no reminders.
 */
export function planReminders(doses, t, now = new Date()) {
  // TODO(rudra): decide the reminder rules. Questions to settle:
  //  - Which doses? (only 'pending' ones whose time is still in the future)
  //  - One notification per dose, or one per slot? (Kantaben takes 3 tablets at 08:00:
  //    3 notifications at once, or 1 saying "3 medicines"?)
  //  - When? (at the dose time, or a few minutes before?)
  //  - A second nudge if still not taken? (the dose can be marked until 2 h after its time)
  //  - Should critical medicines (isCritical) say something different?
  return [];
}

/** Ask for notification permission (Android 13+ shows a dialog once). Returns true if allowed. */
export async function enableReminders() {
  if (!isApp) return false;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

/** Replace every scheduled reminder with a fresh set built from `doses`. Pass [] to clear them all. */
export async function syncReminders(doses, t) {
  if (!isApp) return;
  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });

  const reminders = planReminders(doses, t);
  if (reminders.length === 0) return;
  await LocalNotifications.schedule({
    notifications: reminders.map(({ id, at, title, body }) => ({
      id,
      title,
      body,
      schedule: { at, allowWhileIdle: true }, // fire even when the phone is dozing
    })),
  });
}
