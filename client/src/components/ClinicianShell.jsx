import { NavLink, Outlet } from 'react-router';
import { useEscalationAlerts } from '../lib/alerts.js';
import { useAuth } from '../lib/auth.jsx';
import { useEscalations } from '../lib/queries.js';
import { Logo } from './Logo.jsx';

function AlertsButton({ permission, onEnable }) {
  if (permission === 'granted' || permission === 'unsupported') return null;
  return (
    <button
      type="button"
      onClick={onEnable}
      disabled={permission === 'denied'}
      className="mt-3 w-full rounded-lg bg-haldi px-3 py-2 text-sm font-bold text-ink hover:bg-haldi/90 disabled:bg-white/10 disabled:font-normal disabled:text-white/60"
    >
      {permission === 'denied' ? 'Alerts blocked: allow notifications in the browser settings' : '🔔 Turn on alerts'}
    </button>
  );
}

export function ClinicianShell() {
  const { user, logout } = useAuth();
  // Keeps polling while the tab is hidden, so alerts still arrive when the clinician is on another tab.
  const escalations = useEscalations({ status: 'open' }, { refetchIntervalInBackground: true });
  const openCount = escalations.data?.length ?? 0;
  const alerts = useEscalationAlerts(escalations.data);

  const NAV = [
    { to: '/d', label: 'Dashboard', end: true },
    { to: '/d/escalations', label: 'Escalations', badge: openCount },
    { to: '/d/patients', label: 'Patients' },
    { to: '/d/plans/new', label: 'New plan' },
  ];

  return (
    <div className="min-h-dvh md:flex">
      <aside className="bg-ink text-white md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Logo inverted />
          <button type="button" onClick={logout} className="text-sm font-semibold text-white/80 hover:text-white md:hidden">
            Log out
          </button>
        </div>
        <nav aria-label="Main" className="overflow-x-auto px-3 pb-3 md:flex-1 md:pb-0">
          <ul className="flex gap-1 md:flex-col">
            {NAV.map(({ to, label, end, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 font-semibold transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {label}
                  {badge > 0 && (
                    <span className="rounded-full bg-kumkum px-2 text-sm leading-6 text-white" aria-label={`${badge} open`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden border-t border-white/15 px-5 py-4 md:block">
          <p className="font-semibold">{user?.fullName}</p>
          <button type="button" onClick={logout} className="mt-1 text-sm text-white/75 hover:text-white">
            Log out
          </button>
          <AlertsButton permission={alerts.permission} onEnable={alerts.enable} />
          <p className="mt-3 text-xs text-white/50">Demo system · synthetic data only</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
