import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import gu from './gu.json';
import hi from './hi.json';
import { storage } from '../lib/storage.js';

export const LANGUAGES = [
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

// Before login (FR-8.2): the last language used on this device, else the browser language, else English.
function initialLanguage() {
  const saved = storage.get('lang');
  if (LANGUAGES.some((l) => l.code === saved)) return saved;
  const browser = (navigator.language || 'en').slice(0, 2);
  return LANGUAGES.some((l) => l.code === browser) ? browser : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, gu: { translation: gu } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
});

i18n.on('languageChanged', (lng) => {
  storage.set('lang', lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

/** Clinician pages are English only (FR-8.1); this gives English labels for coded values there. */
export const tEn = i18n.getFixedT('en');

export default i18n;
