import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DoseCard } from '../../components/DoseCard.jsx';
import { SunPath } from '../../components/SunPath.jsx';
import { Card, Empty, QueryState } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import {
  FOLLOW_UP_ICON, SLOTS, SLOT_ICON, formatDate, formatDay, istMinutesNow, istTodayISO,
} from '../../lib/format.js';
import { useDoses, useFollowUps, usePlan } from '../../lib/queries.js';

function useMinuteClock() {
  const [minutes, setMinutes] = useState(istMinutesNow);
  useEffect(() => {
    const id = setInterval(() => setMinutes(istMinutesNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return minutes;
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const patientId = user.patientId;
  const plan = usePlan(patientId);
  const doses = useDoses(patientId);
  const followUps = useFollowUps(patientId);
  const nowMinutes = useMinuteClock();
  const today = istTodayISO();

  const nextFollowUp = followUps.data?.find((f) => f.status === 'scheduled' && f.scheduledDate.slice(0, 10) >= today);
  const scrollToSlot = (slot) => document.getElementById(`slot-${slot}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('home.greeting', { name: user.fullName.split(' ')[0] })}</h1>
        <p className="mt-1 text-ink-soft">{formatDate(`${today}T00:00:00Z`, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <Link
        to="/p/report"
        className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-kumkum px-5 text-xl font-bold text-white shadow-sm hover:bg-kumkum/90"
      >
        <span className="text-2xl" aria-hidden="true">🤒</span>
        {t('home.unwell')}
      </Link>

      <QueryState query={plan}>
        {({ plan: carePlan }) =>
          !carePlan ? (
            <Empty icon="📋">{t('home.noPlan')}</Empty>
          ) : (
            <QueryState query={doses}>
              {(list) => {
                const taken = list.filter((d) => d.status === 'taken').length;
                const queryKey = ['doses', patientId, 'today', 'today'];
                return (
                  <section aria-labelledby="today-heading" className="space-y-5">
                    <Card className="px-3 pb-2 pt-4">
                      <div className="flex items-baseline justify-between px-2">
                        <h2 id="today-heading" className="text-xl font-bold">{t('home.todaysMedicines')}</h2>
                        {list.length > 0 && (
                          <p className={`font-semibold ${taken === list.length ? 'text-neem' : 'text-ink-soft'}`}>
                            {taken === list.length ? `✓ ${t('home.allDone')}` : t('home.progress', { taken, total: list.length })}
                          </p>
                        )}
                      </div>
                      <SunPath doses={list} nowMinutes={nowMinutes} onSelect={scrollToSlot} />
                    </Card>

                    {list.length === 0 && <Empty icon="💊">{t('home.noDoses')}</Empty>}
                    {SLOTS.map((slot) => {
                      const slotDoses = list.filter((d) => d.slot === slot);
                      if (slotDoses.length === 0) return null;
                      return (
                        <div key={slot} id={`slot-${slot}`} className="scroll-mt-20">
                          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                            <span aria-hidden="true">{SLOT_ICON[slot]}</span> {t(`slot.${slot}`)}
                          </h3>
                          <ul className="space-y-2">
                            {slotDoses.map((dose) => <DoseCard key={dose.adherenceId} dose={dose} queryKey={queryKey} />)}
                          </ul>
                        </div>
                      );
                    })}
                  </section>
                );
              }}
            </QueryState>
          )
        }
      </QueryState>

      {nextFollowUp && (
        <Link to="/p/followups" className="block">
          <Card className="flex items-center gap-4 p-4 hover:border-ink/30">
            <span className="grid size-12 place-items-center rounded-xl bg-haldi-soft text-2xl" aria-hidden="true">
              {FOLLOW_UP_ICON[nextFollowUp.type]}
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{t('home.nextCheckup')}</p>
              <p className="text-lg font-semibold">
                {formatDay(nextFollowUp.scheduledDate, i18n.language)} · {t(`followUpType.${nextFollowUp.type}`)}
              </p>
            </div>
          </Card>
        </Link>
      )}
    </div>
  );
}
