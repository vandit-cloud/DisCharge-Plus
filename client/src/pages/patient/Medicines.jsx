import { useTranslation } from 'react-i18next';
import { Card, Empty, QueryState } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { SLOT_ICON, SLOTS, addDaysISO, formatDate, istDateOf, istTodayISO, medicineName } from '../../lib/format.js';
import { useAdherence, useDoses, usePlan } from '../../lib/queries.js';

const DOT = { taken: 'bg-neem', missed: 'bg-kumkum', pending: 'bg-line' };

export default function Medicines() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const today = istTodayISO();
  const from = addDaysISO(today, -6);
  const plan = usePlan(user.patientId);
  const history = useDoses(user.patientId, { from, to: today });
  const adherence = useAdherence(user.patientId);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('medicines.title')}</h1>
        {adherence.data && (
          <p className="mt-1 text-lg text-ink-soft">
            {adherence.data.last7Days.percent === null
              ? t('medicines.noDataYet')
              : t('medicines.thisWeek', { percent: adherence.data.last7Days.percent })}
          </p>
        )}
      </div>

      <QueryState query={plan}>
        {({ plan: p, prescriptions }) =>
          !p ? (
            <Empty icon="💊">{t('home.noPlan')}</Empty>
          ) : (
            <ul className="space-y-3">
              {prescriptions.map((rx) => {
                const doses = (history.data ?? []).filter((d) => d.prescriptionId === rx.prescriptionId);
                return (
                  <li key={rx.prescriptionId}>
                    <Card className={`p-4 ${rx.isCritical ? 'border-haldi' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold">{medicineName(rx.medication)}</p>
                          <p className="text-ink-soft">
                            {rx.dosage} · {t(`frequency.${rx.frequency}`)} · {t('medicines.forDays', { count: rx.durationDays })}
                          </p>
                        </div>
                        {rx.isCritical && <span className="shrink-0 text-2xl text-haldi" aria-label={t('medicines.critical')}>★</span>}
                      </div>
                      {rx.isCritical && <p className="mt-2 font-semibold text-amber">{t('medicines.critical')}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {SLOTS.filter((s) => rx.timingSlots.includes(s)).map((slot) => (
                          <span key={slot} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 font-semibold">
                            <span aria-hidden="true">{SLOT_ICON[slot]}</span> {t(`slot.${slot}`)}
                          </span>
                        ))}
                      </div>
                      {history.data && (
                        <div className="mt-4">
                          <p className="mb-1.5 text-sm font-semibold text-ink-soft">{t('medicines.last7')}</p>
                          <div className="grid grid-cols-7 gap-1.5">
                            {days.map((day) => {
                              const dayDoses = doses.filter((d) => istDateOf(d.scheduledAt) === day);
                              return (
                                <div key={day} className="text-center">
                                  <div className="flex h-5 items-center justify-center gap-0.5">
                                    {dayDoses.map((d) => (
                                      <span key={d.adherenceId} className={`size-2.5 rounded-full ${DOT[d.status]}`} title={t(`home.${d.status === 'pending' ? 'later' : d.status}`)} />
                                    ))}
                                  </div>
                                  <p className="text-xs text-ink-soft">{formatDate(`${day}T00:00:00Z`, i18n.language, { weekday: 'narrow' })}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )
        }
      </QueryState>
    </div>
  );
}
