// Building blocks for the clinician pages (English only, FR-8.1).
import { Link } from 'react-router';
import { tEn } from '../i18n/index.js';
import { TIER_STYLE, timeAgo } from '../lib/format.js';
import { TierBadge } from './ui.jsx';

const TIER_LABEL = { self_care: 'Self-care', teleconsult: 'Teleconsult', urgent: 'Urgent', emergency: 'Emergency' };
export const tierLabel = (tier) => TIER_LABEL[tier] ?? tier;
export const symptomLabel = (code) => tEn(`symptom.${code}`);

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link to={back.to} className="mb-2 inline-block font-semibold text-ink-soft hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A row of toggle buttons; exactly one value is active. */
export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-xl border border-line bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${value === option.value ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_STYLE = {
  open: 'bg-kumkum-soft text-kumkum',
  acknowledged: 'bg-amber-soft text-amber',
  resolved: 'bg-neem-soft text-neem',
};

export function StatusPill({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** One escalation in a list: tier stripe, who, why, how long ago. */
export function EscalationRow({ escalation, showPatient = true }) {
  const style = TIER_STYLE[escalation.tier];
  return (
    <li>
      <Link
        to={`/d/escalations/${escalation.escalationId}`}
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 bg-white px-4 py-3 hover:bg-paper ${style.stripe}`}
      >
        <div className="w-32 shrink-0">
          <TierBadge tier={escalation.tier} label={tierLabel(escalation.tier)} />
        </div>
        <div className="min-w-0 flex-1">
          {showPatient && <p className="font-semibold">{escalation.patient?.fullName}</p>}
          <p className="truncate text-sm text-ink-soft">
            {escalation.source === 'missed_critical_dose' ? '💊 Missed critical dose' : '🤒 Symptom report'} · {escalation.reasons.join(' · ')}
          </p>
        </div>
        <span className="text-sm tabular-nums text-ink-soft">{timeAgo(escalation.createdAt)}</span>
        <StatusPill status={escalation.status} />
      </Link>
    </li>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
