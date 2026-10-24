import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './LanguageSwitch.jsx';
import { Logo } from './Logo.jsx';

export function AuthLayout({ title, subtitle, children }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-4">
        <Logo />
        <LanguageSwitch />
      </header>
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <h1 className="text-4xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-ink-soft">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        <p className="mt-12 text-center text-sm text-ink-soft">{t('app.synthetic')}</p>
      </main>
    </div>
  );
}
