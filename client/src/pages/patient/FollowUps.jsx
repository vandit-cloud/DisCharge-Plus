import { useTranslation } from 'react-i18next';
import { Card, Empty, QueryState } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { FOLLOW_UP_ICON, formatDay, istTodayISO } from '../../lib/format.js';
import { useFollowUps } from '../../lib/queries.js';

function statusLabel(f, today) {
  if (f.status === 'completed') return { key: 'completed', className: 'bg-neem-soft text-neem' };
  if (f.status === 'missed') return { key: 'missed', className: 'bg-kumkum-soft text-kumkum' };
  if (f.overdue) return { key: 'overdue', className: 'bg-clay-soft text-clay' };
  if (f.scheduledDate.slice(0, 10) === today) return { key: 'today', className: 'bg-haldi-soft text-amber' };
  return null;
}

function FollowUpItem({ followUp, today }) {
  const { t, i18n } = useTranslation();
  const status = statusLabel(followUp, today);
  return (
    <li>
      <Card className="flex items-center gap-4 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-paper text-2xl" aria-hidden="true">
          {FOLLOW_UP_ICON[followUp.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{formatDay(followUp.scheduledDate, i18n.language)}</p>
          <p className="text-ink-soft">{t(`followUpType.${followUp.type}`)}</p>
        </div>
        {status && <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}>{t(`followUpStatus.${status.key}`)}</span>}
      </Card>
    </li>
  );
}

export default function FollowUps() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const followUps = useFollowUps(user.patientId);
  const today = istTodayISO();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('followups.title')}</h1>
      <QueryState query={followUps}>
        {(list) => {
          if (list.length === 0) return <Empty icon="📅">{t('followups.none')}</Empty>;
          // Coming up = still planned (overdue ones stay here so they aren't forgotten).
          const upcoming = list.filter((f) => f.status === 'scheduled');
          const past = list.filter((f) => f.status !== 'scheduled').reverse();
          return (
            <>
              {upcoming.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xl font-bold">{t('followups.upcoming')}</h2>
                  <ul className="space-y-2">{upcoming.map((f) => <FollowUpItem key={f.followUpId} followUp={f} today={today} />)}</ul>
                </section>
              )}
              {past.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-xl font-bold text-ink-soft">{t('followups.past')}</h2>
                  <ul className="space-y-2 opacity-80">{past.map((f) => <FollowUpItem key={f.followUpId} followUp={f} today={today} />)}</ul>
                </section>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
