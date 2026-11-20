import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card, Empty, QueryState } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { SYMPTOM_ICON, formatDate } from '../../lib/format.js';
import { usePlan } from '../../lib/queries.js';

export default function CarePlan() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const plan = usePlan(user.patientId);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('plan.title')}</h1>
      <QueryState query={plan}>
        {({ plan: p }) =>
          !p ? (
            <Empty icon="📋">{t('home.noPlan')}</Empty>
          ) : (
            <>
              {p.status !== 'active' && (
                <p className="rounded-xl bg-amber-soft px-4 py-3 font-medium text-amber">
                  {t('plan.closed', { status: t(`planStatus.${p.status}`) })}
                </p>
              )}
              <Card className="divide-y divide-line">
                <div className="p-4">
                  <p className="text-sm font-semibold text-ink-soft">{t('plan.diagnosis')}</p>
                  {/* Written by the clinician; free text is not translated (FR-8.4). */}
                  <p className="mt-0.5 text-lg font-semibold" lang="en">{p.primaryDiagnosis}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink-soft">{t('plan.doctor')}</p>
                    <p className="mt-0.5 font-semibold">{p.clinicianName}</p>
                  </div>
                  <p className="self-end font-semibold">{t('plan.discharged', { date: formatDate(p.dischargeDate, i18n.language) })}</p>
                </div>
              </Card>

              <section aria-labelledby="danger-heading" className="rounded-2xl border-2 border-kumkum/25 bg-kumkum-soft/50 p-4">
                <h2 id="danger-heading" className="text-xl font-bold text-kumkum">⚠ {t('plan.dangerSigns')}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {p.redFlags.map((code) => (
                    <li key={code} className="flex items-center gap-2 rounded-xl bg-surface p-3 font-semibold">
                      <span className="text-2xl" aria-hidden="true">{SYMPTOM_ICON[code]}</span>
                      {t(`symptom.${code}`)}
                    </li>
                  ))}
                </ul>
                <Link to="/p/report" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-kumkum px-4 text-lg font-bold text-on-danger">
                  🤒 {t('home.unwell')}
                </Link>
              </section>

              <a href="tel:108" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-ink px-4 text-lg font-bold">
                🚑 {t('plan.emergency')}
              </a>
            </>
          )
        }
      </QueryState>
    </div>
  );
}
