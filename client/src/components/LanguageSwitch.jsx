import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/index.js';
import { useAuth } from '../lib/auth.jsx';

/** Three buttons, each labelled in its own script, so anyone can find their language. */
export function LanguageSwitch({ className = '' }) {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useAuth();
  return (
    <div role="group" aria-label={t('app.language')} className={`inline-flex rounded-full border border-line bg-white p-0.5 ${className}`}>
      {LANGUAGES.map(({ code, label }) => {
        const active = i18n.language === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => setLanguage(code).catch(() => {})}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${active ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
