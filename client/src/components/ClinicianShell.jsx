import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useEscalationAlerts } from '../lib/alerts.js';
import { useAuth } from '../lib/auth.jsx';
import { useEscalations } from '../lib/queries.js';
import { Logo } from './Logo.jsx';

function AlertsButton({ permission, onEnable }) {
  if (permission === 'granted' || permission === 'unsupported') return null;
  if (permission === 'denied') {
    return <span className="hidden text-sm text-ink-soft lg:inline">Alerts blocked in browser settings</span>;
  }
  return (
    <button
      type="button"
      onClick={onEnable}
      className="rounded-xl bg-haldi px-3 py-2 text-sm font-bold text-slate transition-colors hover:bg-haldi/90"
    >
      🔔 Turn on alerts
    </button>
  );
}

const initials = (name = '') =>
  name.replace(/^Dr\.?\s*/, '').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();

export function ClinicianShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  // Keeps polling while the tab is hidden, so alerts still arrive when the clinician is on another tab.
  const escalations = useEscalations({ status: 'open' }, { refetchIntervalInBackground: true });
  const openCount = escalations.data?.length ?? 0;
  const alerts = useEscalationAlerts(escalations.data);

  const NAV = [
    { to: '/d', label: 'Dashboard', end: true },
    { to: '/d/patients', label: 'Patients' },
    { to: '/d/escalations', label: 'Escalations', badge: openCount },
    { to: '/d/plans/new', label: 'New plan' },
  ];

  return (
    <div className="theme-dark flex flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-slate/60 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-7">
          <Link to="/d" className="rounded-xl">
            <Logo />
          </Link>
          <nav aria-label="Main" className="order-3 -mx-1 w-full overflow-x-auto md:order-none md:mx-0 md:w-auto md:flex-1">
            <ul className="flex gap-1">
              {NAV.map(({ to, label, end, badge }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `relative flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 font-semibold transition-colors ${
                        isActive
                          ? 'text-ink after:absolute after:inset-x-3.5 after:bottom-0.5 after:h-[3px] after:rounded-full after:bg-lagoon'
                          : 'text-ink-soft hover:bg-paper hover:text-ink'
                      }`
                    }
                  >
                    {label}
                    {badge > 0 && (
                      <span className="grid min-w-6 place-items-center rounded-full bg-kumkum px-1.5 text-xs font-bold leading-6 text-on-danger" aria-label={`${badge} open`}>
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <AlertsButton permission={alerts.permission} onEnable={alerts.enable} />
            <span className="hidden text-sm text-ink-soft sm:inline">{user?.fullName}</span>
            <span className="grid size-9 place-items-center rounded-full border border-line bg-paper font-display text-sm font-bold" aria-hidden="true">
              {initials(user?.fullName)}
            </span>
            <button type="button" onClick={logout} className="rounded-lg px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-paper hover:text-ink">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-7 md:px-7">
        {/* Keyed on the path: each page fades in when the clinician moves between pages. */}
        <div key={location.pathname} className="anim-fade">
          <Outlet />
        </div>
      </main>
      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 text-sm text-ink-soft md:px-7">Demo system · synthetic data only</footer>
    </div>
  );
}
