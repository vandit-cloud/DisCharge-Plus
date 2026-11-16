import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { addDaysISO, istTodayISO } from '../lib/format.js';
import { useDoses } from '../lib/queries.js';
import { enableReminders, isApp, syncReminders } from '../lib/reminders.js';
import { LanguageSwitch } from './LanguageSwitch.jsx';
import { Logo } from './Logo.jsx';

const NAV = [
  { to: '/p', icon: '🏠', key: 'nav.home', end: true },
  { to: '/p/medicines', icon: '💊', key: 'nav.medicines' },
  { to: '/p/plan', icon: '📋', key: 'nav.plan' },
  { to: '/p/followups', icon: '📅', key: 'nav.followups' },
];

// App only: keeps phone reminders in step with today's and tomorrow's doses. Tomorrow is included so
// the morning reminder is set even if the app isn't opened before then. The doses query refetches
// every minute and when the app comes back to the foreground, so a dose marked taken or a plan the
// clinician changed replaces the old reminders. Leaving the patient pages (logout) clears them,
// because the phone may be shared.
function useDoseReminders(patientId) {
  const { t } = useTranslation();
  const today = istTodayISO();
  const doses = useDoses(isApp ? patientId : null, { from: today, to: addDaysISO(today, 1) });

  useEffect(() => {
    enableReminders();
    return () => { syncReminders([], t); };
  }, []); // once: ask permission on entry, clear the reminders on leaving (logout)

  useEffect(() => {
    if (doses.data) syncReminders(doses.data, t).catch((error) => console.warn('Reminders not scheduled:', error));
  }, [doses.data, t]);
}

export function PatientShell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  useDoseReminders(user.patientId);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-2.5">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageSwitch />
            <button
              type="button"
              onClick={logout}
              aria-label={t('app.logout')}
              title={t('app.logout')}
              className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-32 pt-5">
        <Outlet />
        <p className="mt-10 text-center text-sm text-ink-soft">{t('app.synthetic')}</p>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map(({ to, icon, key, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${isActive ? 'text-ink' : 'text-ink-soft'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid h-8 w-12 place-items-center rounded-full text-xl ${isActive ? 'bg-haldi-soft' : ''}`} aria-hidden="true">
                      {icon}
                    </span>
                    {t(key)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
