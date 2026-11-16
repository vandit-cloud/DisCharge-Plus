// Dose reminders as phone notifications. Only the Android app (Capacitor) schedules them; on the
// website every function here does nothing. The phone sets its own alarms from the doses it has
// already downloaded, so a reminder still fires with no signal. Missed-dose escalation stays on the
// server (the cron sweep): the phone reminds, the server is the safety net.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { medicineName } from './format.js';

export const isApp = Capacitor.isNativePlatform();

/**
 * Android notification ids must be 32-bit integers, so derive one from the dose's adherenceId
 * (a 24-hex-digit MongoDB ObjectId). The last 7 hex digits are the ObjectId's counter, unique per
 * dose. `nudge` lets you give a second reminder for the same dose its own id (0 = first, 1 = second).
 */
export function reminderId(adherenceId, nudge = 0) {
  return parseInt(adherenceId.slice(-7), 16) * 4 + nudge;
}

const NUDGE_MINUTES = 60; // a dose turns "missed" at 120 min (DOSE_GRACE_MINUTES on the server)

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
  // Policy (chosen by AI, review):
  //  - One notification per slot time, not per tablet: Kantaben takes 3 tablets at 08:00 and
  //    should hear one reminder listing all three.
  //  - First reminder at the dose time, matching the slot the sun-path shows. The "Mark taken"
  //    button is already open (from 1 h before), so tapping the notification lets her mark it.
  //  - One nudge NUDGE_MINUTES later for whatever is still pending. Marking a dose refetches the
  //    doses and reschedules, so the nudge disappears once she has marked them. It stays well
  //    inside the 2 h grace window, before the server marks the dose missed and escalates.
  //  - If any medicine in the slot is critical, both notifications add the "don't miss" line.
  const bySlotTime = new Map();
  for (const dose of doses) {
    if (dose.status !== 'pending') continue;
    const group = bySlotTime.get(dose.scheduledAt) ?? [];
    group.push(dose);
    bySlotTime.set(dose.scheduledAt, group);
  }

  const reminders = [];
  for (const [scheduledAt, group] of bySlotTime) {
    const slot = t(`slot.${group[0].slot}`);
    const medicines = group.map((d) => medicineName(d.prescription?.medication)).filter(Boolean).join(', ');
    const critical = group.some((d) => d.prescription?.isCritical);
    const body = t('reminder.body', { medicines }) + (critical ? `\n${t('reminder.critical')}` : '');
    const id = group.map((d) => d.adherenceId).sort()[0];
    const due = new Date(scheduledAt);
    const nudge = new Date(due.getTime() + NUDGE_MINUTES * 60_000);

    if (due > now) reminders.push({ id: reminderId(id, 0), at: due, title: t('reminder.title', { slot }), body });
    if (nudge > now) reminders.push({ id: reminderId(id, 1), at: nudge, title: t('reminder.nudge', { slot }), body });
  }
  return reminders;
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
      // Inexact alarm: may arrive a few minutes late, which is fine for a medicine reminder.
      // Exact alarms need "Alarms & reminders" access, which Android 14+ denies by default; the
      // plugin would then open that settings screen on every schedule() and wait there.
      isExactNotification: false,
    })),
  });
}
