import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CountUp, Donut, TrendChart } from '../../components/charts.jsx';
import { PageHeader, Section, tierLabel } from '../../components/clinician.jsx';
import { Empty, QueryState, RiskBadge, TierBadge } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { FOLLOW_UP_ICON, RISK_STYLE, TIER_STYLE, formatDate, istMinutesNow, istTodayISO, timeAgo } from '../../lib/format.js';
import { useDashboard } from '../../lib/queries.js';

function greeting() {
  const hour = Math.floor(istMinutesNow() / 60);
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

const initials = (name = '') => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
const daysBetweenISO = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);

function Avatar({ name }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-paper font-display text-sm font-bold" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** The big top card: how many patients need attention, plus the 14-day adherence trend. */
function Hero({ d }) {
  const attention = d.riskBands.high + d.riskBands.moderate;
  const trend = d.adherenceTrend;
  return (
    <section className="card-shadow grid gap-7 rounded-3xl border border-line bg-surface p-6 md:grid-cols-[0.9fr_1.3fr] md:p-7 lg:col-span-8">
      <div className="flex flex-col justify-between gap-6">
        <div>
          <p className="font-medium text-ink-soft">Patients who need attention today</p>
          <p className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-7xl font-extrabold leading-none tabular-nums md:text-8xl">
              <CountUp value={attention} />
            </span>
            <span className="text-lg text-ink-soft">of {d.activePatients} active</span>
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-7 gap-y-3">
          {[
            ['Emergency', d.openEscalations.emergency, 'bg-kumkum'],
            ['Urgent', d.openEscalations.urgent, 'bg-clay'],
            ['Overdue follow-ups', d.overdueFollowUps.length, null],
          ].map(([label, value, dot]) => (
            <div key={label}>
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-display text-2xl font-bold tabular-nums">
                {dot && <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" />}
                <CountUp value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {trend && (
        <div className="flex min-w-0 flex-col">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-ink-soft">Doses taken, last 14 days</p>
            {trend.percent !== null && (
              <p className="font-display text-3xl font-bold tabular-nums">
                <CountUp value={trend.percent} />%
              </p>
            )}
          </div>
          <div className="mt-auto pt-2">
            <TrendChart days={trend.days} label={`Share of due doses taken each day; ${trend.percent ?? 'no'}% over 14 days`} />
          </div>
        </div>
      )}
    </section>
  );
}

function QuickActions() {
  const base = 'flex min-h-12 items-center gap-3 rounded-2xl border px-4 font-semibold transition active:scale-[0.98]';
  return (
    <Section title="Quick actions" className="lg:col-span-4">
      <div className="grid gap-2.5 px-6 pb-6 pt-2">
        <Link to="/d/plans/new" className={`${base} border-transparent bg-brand text-on-brand hover:bg-brand/90`}>
          <span aria-hidden="true">＋</span> New discharge plan
        </Link>
        <Link to="/d/escalations" className={`${base} border-line bg-paper hover:border-ink/40`}>
          <span aria-hidden="true">🔔</span> Open escalation queue
        </Link>
        <Link to="/d/patients" className={`${base} border-line bg-paper hover:border-ink/40`}>
          <span aria-hidden="true">🔍</span> Find a patient
        </Link>
        <a href="#phone-first" className={`${base} border-line bg-paper hover:border-ink/40`}>
          <span aria-hidden="true">📞</span> Whom to phone first
        </a>
      </div>
    </Section>
  );
}

function NeedsAttention({ patients, total }) {
  return (
    <Section title="Needs attention" className="lg:col-span-6" action={<Link to="/d/patients" className="text-sm font-semibold text-lagoon hover:underline">All {total} patients</Link>}>
      {patients.length === 0 ? (
        <div className="p-5"><Empty icon="✓">No patient is at moderate or high risk right now.</Empty></div>
      ) : (
        <ul className="grid grid-cols-1 gap-1 px-3 pb-4">
          {patients.slice(0, 6).map((p) => (
            <li key={p.patientId}>
              <Link to={`/d/patients/${p.patientId}`} className="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition-colors hover:bg-paper">
                <Avatar name={p.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.fullName}</p>
                  <p className="truncate text-sm text-ink-soft">{p.riskReasons.join(' · ')}</p>
                </div>
                <div className="shrink-0 text-right">
                  <RiskBadge band={p.riskBand} />
                  {p.adherencePercent !== null && (
                    <>
                      <div className="ml-auto mt-1.5 h-1.5 w-16 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                        <div className={`anim-grow h-full rounded-full ${p.adherencePercent < 80 ? 'bg-amber' : 'bg-lagoon'}`} style={{ width: `${p.adherencePercent}%` }} />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">{p.adherencePercent}% adherence</p>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function OpenEscalations({ items }) {
  const queryClient = useQueryClient();
  const acknowledge = useMutation({
    mutationFn: (id) => api(`/escalations/${id}/acknowledge`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
  });
  return (
    <Section title="Open escalations" className="lg:col-span-6" action={<Link to="/d/escalations" className="text-sm font-semibold text-lagoon hover:underline">Open queue</Link>}>
      {items.length === 0 ? (
        <p className="px-6 pb-6 pt-2 text-ink-soft">No open escalations.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1 px-3 pb-4">
          {items.map((e) => (
            <li key={e.escalationId} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-paper">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${TIER_STYLE[e.tier].bg}`} aria-hidden="true">{TIER_STYLE[e.tier].icon}</span>
              <Link to={`/d/escalations/${e.escalationId}`} className="min-w-0 flex-1">
                <p className="font-semibold hover:underline">{e.patient?.fullName}</p>
                <p className="truncate text-sm text-ink-soft">{e.reasons.join(' · ')}</p>
              </Link>
              <div className="hidden shrink-0 text-right sm:block">
                <TierBadge tier={e.tier} label={tierLabel(e.tier)} />
                <p className="mt-0.5 text-xs text-ink-soft">{timeAgo(e.createdAt)}</p>
              </div>
              {e.status === 'open' ? (
                <button
                  type="button"
                  onClick={() => acknowledge.mutate(e.escalationId)}
                  disabled={acknowledge.isPending && acknowledge.variables === e.escalationId}
                  className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
                >
                  Acknowledge
                </button>
              ) : (
                <span className="shrink-0 rounded-xl bg-neem-soft px-3 py-1.5 text-sm font-semibold text-neem">✓ Acknowledged</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function RiskAndWeek({ d }) {
  const tiers = ['emergency', 'urgent', 'teleconsult'];
  const maxTier = Math.max(1, ...tiers.map((t) => d.openEscalations[t]));
  return (
    <Section title="Active patients by risk" className="lg:col-span-4">
      <div className="px-6 pb-6">
        {d.activePatients === 0 ? (
          <p className="pt-2 text-ink-soft">No active plans.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <Donut
              center={<CountUp value={d.activePatients} />}
              centerLabel="active"
              parts={['high', 'moderate', 'low'].map((band) => ({
                key: band,
                label: RISK_STYLE[band].label,
                n: d.riskBands[band],
                strokeClass: { high: 'stroke-kumkum', moderate: 'stroke-amber', low: 'stroke-neem' }[band],
              }))}
            />
            <dl className="grid gap-2.5">
              {['high', 'moderate', 'low'].map((band) => (
                <div key={band} className="flex items-center gap-2.5">
                  <span className={`size-3 rounded ${RISK_STYLE[band].solid}`} aria-hidden="true" />
                  <dd className="min-w-6 font-display text-xl font-bold tabular-nums">{d.riskBands[band]}</dd>
                  <dt>{RISK_STYLE[band].label}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}

        <h3 className="mt-6 border-t border-line pt-5 font-semibold">Open escalations by tier</h3>
        <div className="mt-3 grid gap-2.5">
          {tiers.map((tier) => (
            <div key={tier} className="grid grid-cols-[7.5rem_1fr_1.5rem] items-center gap-3 text-sm">
              <span className="text-ink-soft"><span aria-hidden="true">{TIER_STYLE[tier].icon}</span> {tierLabel(tier)}</span>
              <span className="h-2.5 rounded-r bg-paper">
                <span className={`anim-grow block h-full rounded-r ${TIER_STYLE[tier].solid}`} style={{ width: `${(d.openEscalations[tier] / maxTier) * 100}%` }} />
              </span>
              <span className="text-right font-display font-bold tabular-nums">{d.openEscalations[tier]}</span>
            </div>
          ))}
        </div>

        <h3 className="mt-6 border-t border-line pt-5 font-semibold">This week</h3>
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm text-ink-soft">Follow-ups due</dt>
            <dd className="font-display text-3xl font-bold tabular-nums"><CountUp value={(d.upcomingFollowUps ?? []).length} /></dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Patients discharged</dt>
            <dd className="font-display text-3xl font-bold tabular-nums"><CountUp value={d.dischargedLast7Days ?? 0} /></dd>
          </div>
        </dl>
      </div>
    </Section>
  );
}

const BAND_FILL = { high: 'bg-kumkum', moderate: 'bg-amber', low: 'bg-neem' };
const SCALE_MAX = 0.5; // bars run from 0 to 50 %: no-show scores rarely go higher

/** Upcoming follow-ups as bars of no-show risk, with the Moderate and High cut-offs drawn in. */
function PhoneFirst({ rows, cutoffs }) {
  const pct = (p) => `${Math.min(p / SCALE_MAX, 1) * 100}%`;
  return (
    <section id="phone-first" className="card-shadow scroll-mt-24 rounded-3xl border border-line bg-surface lg:col-span-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 pb-2 pt-5">
        <h2 className="text-lg font-bold">Whom to phone first</h2>
        <p className="text-sm text-ink-soft">Follow-ups in the next 7 days, highest no-show risk first</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-6 pt-2 text-ink-soft">No follow-ups in the next 7 days.</p>
      ) : (
        <div className="px-6 pb-6">
          {cutoffs && (
            <div className="relative ml-[calc(min(11rem,38%)+0.75rem)] mr-14 hidden h-5 sm:block" aria-hidden="true">
              <span className="absolute -translate-x-1/2 text-xs text-ink-soft" style={{ left: pct(cutoffs.moderate) }}>Moderate</span>
              <span className="absolute -translate-x-1/2 text-xs text-ink-soft" style={{ left: pct(cutoffs.high) }}>High</span>
            </div>
          )}
          <ul className="grid grid-cols-1 gap-2.5">
            {rows.map((f, i) => (
              <li key={f.followUpId}>
                <Link to={`/d/patients/${f.patientId}`} className="-mx-2 grid grid-cols-[min(11rem,38%)_1fr_3rem] items-center gap-x-3 rounded-xl px-2 py-1 transition-colors hover:bg-paper">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{f.fullName}</p>
                    <p className="truncate text-xs text-ink-soft">
                      <span aria-hidden="true">{FOLLOW_UP_ICON[f.type]}</span> {formatDate(f.scheduledDate, 'en', { weekday: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="relative h-6" title={f.noShowReasons.join(' · ')}>
                    {cutoffs &&
                      [cutoffs.moderate, cutoffs.high].map((c) => (
                        <span key={c} className="absolute -inset-y-1 border-l border-dashed border-ink-soft/50" style={{ left: pct(c) }} aria-hidden="true" />
                      ))}
                    <span
                      className={`anim-grow absolute left-0 top-1 h-4 rounded-r ${f.noShowBand ? BAND_FILL[f.noShowBand] : 'bg-lagoon'}`}
                      style={{ width: pct(f.noShowProbability), animationDelay: `${0.2 + i * 0.04}s` }}
                    />
                  </div>
                  <span className="text-right font-display font-semibold tabular-nums">{Math.round(f.noShowProbability * 100)}%</span>
                  {f.noShowReasons.length > 0 && (
                    <p className="col-start-2 col-end-4 text-xs font-semibold text-amber">{f.noShowReasons.join(' · ')}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-kumkum" />High: riskiest quarter</span>
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-amber" />Moderate: above the median</span>
            <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-neem" />Low</span>
            <span>Estimated by a model trained on public appointment data.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Overdue({ followUps }) {
  const today = istTodayISO();
  return (
    <Section title="Overdue follow-ups" className="lg:col-span-12" action={<span className="text-sm text-ink-soft">Oldest first</span>}>
      {followUps.length === 0 ? (
        <p className="px-6 pb-6 pt-2 text-ink-soft">Nothing overdue.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(19rem,100%),1fr))] gap-1 px-3 pb-4">
          {followUps.map((f) => (
            <li key={f.followUpId}>
              <Link to={`/d/patients/${f.patientId}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-paper">
                <Avatar name={f.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.fullName}</p>
                  <p className="truncate text-sm text-ink-soft"><span aria-hidden="true">{FOLLOW_UP_ICON[f.type]}</span> {f.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold tabular-nums">{daysBetweenISO(f.scheduledDate.slice(0, 10), today)} d</p>
                  <p className="text-xs text-ink-soft">overdue</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
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
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Hero d={d} />
            <QuickActions />
            <NeedsAttention patients={d.topRisk} total={d.totalPatients} />
            <OpenEscalations items={d.openEscalations.items} />
            <RiskAndWeek d={d} />
            {/* `?? []`: while a deploy is rolling out, an older API may not send this list yet. */}
            <PhoneFirst rows={d.upcomingFollowUps ?? []} cutoffs={d.noShowCutoffs} />
            <Overdue followUps={d.overdueFollowUps} />
          </div>
        )}
      </QueryState>
    </>
  );
}
