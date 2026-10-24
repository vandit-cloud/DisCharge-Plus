import { Link } from 'react-router';
import { EscalationRow, PageHeader, Section, tierLabel } from '../../components/clinician.jsx';
import { Empty, QueryState, RiskBadge } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { FOLLOW_UP_ICON, RISK_STYLE, TIER_STYLE, formatDate, istMinutesNow, istTodayISO } from '../../lib/format.js';
import { useDashboard } from '../../lib/queries.js';

function greeting() {
  const hour = Math.floor(istMinutesNow() / 60);
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** Patients by risk band as one proportional bar: the whole cohort at a glance. */
function RiskBar({ bands, total }) {
  const order = ['high', 'moderate', 'low'];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-paper" role="img" aria-label={order.map((b) => `${bands[b]} ${b}`).join(', ')}>
        {order.map((band) =>
          bands[band] > 0 ? <div key={band} className={RISK_STYLE[band].solid} style={{ width: `${(bands[band] / total) * 100}%` }} /> : null,
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {order.map((band) => (
          <div key={band}>
            <dt className={`text-sm font-semibold ${RISK_STYLE[band].text}`}>{RISK_STYLE[band].label}</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{bands[band]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const dashboard = useDashboard();
  const lastName = user.fullName.replace(/^Dr\.?\s*/, '').split(' ').pop();

  return (
    <>
      <PageHeader
        title={`${greeting()}, Dr. ${lastName}`}
        subtitle={formatDate(`${istTodayISO()}T00:00:00Z`, 'en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />
      <QueryState query={dashboard}>
        {(d) => (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Section
                title="Needs attention today"
                action={<Link to="/d/patients" className="text-sm font-semibold text-ink-soft hover:text-ink">All {d.totalPatients} patients →</Link>}
              >
                {d.topRisk.length === 0 ? (
                  <div className="p-5"><Empty icon="✓">No patient is at moderate or high risk right now.</Empty></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="text-sm text-ink-soft">
                        <tr className="border-b border-line">
                          <th className="px-5 py-2 font-semibold">Patient</th>
                          <th className="px-3 py-2 font-semibold">Risk</th>
                          <th className="px-3 py-2 text-right font-semibold">Adherence</th>
                          <th className="px-3 py-2 text-right font-semibold">Open</th>
                          <th className="px-5 py-2 text-right font-semibold">Day</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.topRisk.map((p) => (
                          <tr key={p.patientId} className="border-b border-line last:border-0 hover:bg-paper">
                            <td className="px-5 py-3">
                              <Link to={`/d/patients/${p.patientId}`} className="font-semibold hover:underline">{p.fullName}</Link>
                              <p className="text-sm text-ink-soft">{p.riskReasons.join(' · ')}</p>
                            </td>
                            <td className="px-3 py-3"><RiskBadge band={p.riskBand} /></td>
                            <td className="px-3 py-3 text-right tabular-nums">{p.adherencePercent ?? '–'}{p.adherencePercent !== null && '%'}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{p.openEscalations}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{p.daysSinceDischarge}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section
                title="Open escalations"
                action={<Link to="/d/escalations" className="text-sm font-semibold text-ink-soft hover:text-ink">Open queue →</Link>}
              >
                <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
                  {['emergency', 'urgent', 'teleconsult'].map((tier) => (
                    <span key={tier} className={`rounded-full px-3 py-1 text-sm font-semibold ${TIER_STYLE[tier].bg} ${TIER_STYLE[tier].text}`}>
                      {TIER_STYLE[tier].icon} {d.openEscalations[tier]} {tierLabel(tier).toLowerCase()}
                    </span>
                  ))}
                </div>
                {d.openEscalations.items.length === 0 ? (
                  <p className="px-5 py-6 text-ink-soft">No open escalations.</p>
                ) : (
                  <ul className="divide-y divide-line">{d.openEscalations.items.map((e) => <EscalationRow key={e.escalationId} escalation={e} />)}</ul>
                )}
              </Section>
            </div>

            <div className="min-w-0 space-y-6">
              <Section title={`Active patients by risk (${d.activePatients})`}>
                <div className="p-5">{d.activePatients > 0 ? <RiskBar bands={d.riskBands} total={d.activePatients} /> : <p className="text-ink-soft">No active plans.</p>}</div>
              </Section>
              <Section title="Overdue follow-ups">
                {d.overdueFollowUps.length === 0 ? (
                  <p className="px-5 py-6 text-ink-soft">Nothing overdue.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.overdueFollowUps.map((f) => (
                      <li key={f.followUpId}>
                        <Link to={`/d/patients/${f.patientId}`} className="flex items-start gap-3 px-5 py-3 hover:bg-paper">
                          <span className="text-xl" aria-hidden="true">{FOLLOW_UP_ICON[f.type]}</span>
                          <div>
                            <p className="font-semibold">{f.fullName}</p>
                            <p className="text-sm text-ink-soft">{f.description} · due {formatDate(f.scheduledDate)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
