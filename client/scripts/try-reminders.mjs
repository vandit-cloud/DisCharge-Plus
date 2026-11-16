// Dev check: prints the reminders planReminders() would set for a patient's doses (today + tomorrow)
// from the API (API_URL, default local). Usage: node scripts/try-reminders.mjs [phone] [en|hi|gu] [now ISO]
import { readFileSync, writeFileSync } from 'node:fs';
import i18next from 'i18next';
import { planReminders } from '../src/lib/reminders.js';

const [phone = '9000000101', lng = 'en', nowArg] = process.argv.slice(2);
const now = nowArg ? new Date(nowArg) : new Date();
const resources = Object.fromEntries(
  ['en', 'hi', 'gu'].map((l) => [l, { translation: JSON.parse(readFileSync(new URL(`../src/i18n/${l}.json`, import.meta.url))) }]),
);
await i18next.init({ lng, resources, interpolation: { escapeValue: false } });

const API = process.env.API_URL || 'http://localhost:3000/api';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password: 'demo1234' }),
}).then((r) => r.json());
const day = (d) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const tomorrow = new Date(now.getTime() + 86_400_000);
const { doses } = await fetch(`${API}/patients/${login.user.patientId}/doses?from=${day(now)}&to=${day(tomorrow)}`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((r) => r.json());

const ist = (d) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(5, 16).replace('T', ' ');
const lines = [`now ${ist(now)} IST · ${doses.length} doses (${doses.filter((d) => d.status === 'pending').length} pending)`];
for (const r of planReminders(doses, i18next.t, now)) lines.push(`${ist(r.at)}  #${r.id}  ${r.title} | ${r.body.replace('\n', ' / ')}`);
// Written to a file: the Windows console can't print Gujarati/Hindi.
writeFileSync(new URL('../try-reminders.txt', import.meta.url), `${lines.join('\n')}\n`);
console.log(`${lines.length - 1} reminders -> client/try-reminders.txt`);
