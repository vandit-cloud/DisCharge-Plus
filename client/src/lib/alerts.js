// Clinician alerts (website). The clinician layout already polls open escalations every 30 s; this
// notices the ones that weren't there on the previous poll and announces them: a browser
// notification (visible even when the tab is in the background), a tone, and an open-alert count in
// the tab title. No server change: it reads the same GET /escalations?status=open as the sidebar badge.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { TIER_STYLE } from './format.js';

/**
 * Alert policy: how loudly to announce a NEW open escalation. Pure function, easy to test.
 *
 * @param escalation  { escalationId, tier ('emergency' | 'urgent' | 'teleconsult'),
 *                      source ('symptom_log' | 'missed_dose'), reasons: string[],
 *                      patient: { fullName }, createdAt }
 * @returns null for no alert, or { sound: 0 | 1 | 2 | 3 (number of beeps), sticky: boolean }
 *          sticky = the notification stays on screen until the clinician clicks or closes it.
 */
// Every new escalation gets a notification; only the loudness changes with the tier (Decision B13).
// The tier alone decides, not the source: the server already gives a missed critical dose its tier
// (urgent, D6), so the client doesn't second-guess the rule engine.
const ALERT_BY_TIER = {
  emergency: { sound: 3, sticky: true }, // must not vanish while the clinician is away from the screen
  urgent: { sound: 2, sticky: false },
  teleconsult: { sound: 0, sticky: false }, // silent: a tone for every routine call-back gets ignored
};

export function alertFor(escalation) {
  return ALERT_BY_TIER[escalation?.tier] ?? null; // unknown tier: no alert (it is still in the queue)
}

let audio = null; // created on the first click: browsers block sound until the user has interacted

function unlockAudio() {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume();
}

function beep(times) {
  if (!audio || times === 0) return;
  for (let i = 0; i < times; i++) {
    const start = audio.currentTime + i * 0.35;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.2, start);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    tone.connect(volume).connect(audio.destination);
    tone.start(start);
    tone.stop(start + 0.25);
  }
}

const canNotify = () => typeof Notification !== 'undefined';

function announce(escalation, { sound, sticky }, openEscalation) {
  beep(sound);
  if (!canNotify() || Notification.permission !== 'granted') return;
  const { icon } = TIER_STYLE[escalation.tier];
  const tier = escalation.tier[0].toUpperCase() + escalation.tier.slice(1);
  const notification = new Notification(`${icon} ${tier}: ${escalation.patient?.fullName ?? 'Patient'}`, {
    body: escalation.reasons.slice(0, 2).join(' · '),
    tag: escalation.escalationId, // the same escalation never shows twice
    requireInteraction: sticky,
  });
  notification.onclick = () => {
    window.focus();
    openEscalation(escalation.escalationId);
    notification.close();
  };
}

/**
 * Announces escalations that appear in `openEscalations` after the first load (the ones already
 * open at login are in the queue; alerting them all at once would be noise) and keeps the tab title
 * at "(n) DisCharge+". Returns the notification permission state for the "Turn on alerts" button.
 */
export function useEscalationAlerts(openEscalations) {
  const navigate = useNavigate();
  const seen = useRef(null); // ids already known; null until the first list arrives
  const [permission, setPermission] = useState(canNotify() ? Notification.permission : 'unsupported');

  useEffect(() => {
    document.addEventListener('pointerdown', unlockAudio);
    return () => document.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    if (!openEscalations) return;
    if (seen.current === null) {
      seen.current = new Set(openEscalations.map((e) => e.escalationId));
      return;
    }
    for (const escalation of openEscalations) {
      if (seen.current.has(escalation.escalationId)) continue;
      seen.current.add(escalation.escalationId);
      const alert = alertFor(escalation);
      if (alert) announce(escalation, alert, (id) => navigate(`/d/escalations/${id}`));
    }
  }, [openEscalations, navigate]);

  const count = openEscalations?.length ?? 0;
  useEffect(() => {
    document.title = count > 0 ? `(${count}) DisCharge+` : 'DisCharge+';
    return () => { document.title = 'DisCharge+'; };
  }, [count]);

  const enable = async () => {
    unlockAudio();
    if (canNotify()) setPermission(await Notification.requestPermission());
  };
  return { permission, enable };
}
