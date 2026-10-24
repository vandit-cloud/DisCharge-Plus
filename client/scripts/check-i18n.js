// FR-8.5: every key in en.json must exist (and be non-empty) in hi.json and gu.json, and vice versa.
import { readFileSync } from 'node:fs';

const load = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'));
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );

const reference = new Map(flatten(load('en')));
let problems = 0;
for (const lang of ['hi', 'gu']) {
  const entries = new Map(flatten(load(lang)));
  for (const [key] of reference) {
    if (!entries.has(key) || String(entries.get(key)).trim() === '') {
      console.log(`${lang}: missing ${key}`);
      problems += 1;
    }
  }
  for (const [key, value] of entries) {
    if (!reference.has(key)) {
      console.log(`${lang}: extra key ${key}`);
      problems += 1;
    }
    const placeholders = (s) => (String(s).match(/{{\w+}}/g) ?? []).sort().join();
    if (reference.has(key) && placeholders(value) !== placeholders(reference.get(key))) {
      console.log(`${lang}: placeholders differ in ${key}`);
      problems += 1;
    }
  }
}
console.log(problems ? `${problems} problem(s)` : `OK: ${reference.size} keys in en, hi and gu`);
process.exit(problems ? 1 : 0);
