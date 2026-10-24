import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, ErrorState, Spinner } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { SYMPTOM_ICON, TIER_STYLE } from '../../lib/format.js';
import { useErrorText } from '../../lib/useErrorText.js';

// Same order as the server's list (server/src/rules/symptomCodes.js), most serious first.
const SYMPTOMS = Object.keys(SYMPTOM_ICON);
const FACES = ['🙂', '😐', '😕', '😣', '😫'];

export default function ReportSymptom() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState('pick');
  const [selected, setSelected] = useState([]);
  const [severity, setSeverity] = useState(null);

  const send = useMutation({
    mutationFn: () => api('/symptoms', { method: 'POST', body: { symptoms: selected, severity } }),
    onSuccess: () => {
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['symptoms'] });
    },
  });

  const toggle = (code) => setSelected((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]));

  if (step === 'result' && send.data) {
    const { symptomLog, clinicianAlerted } = send.data;
    const tier = symptomLog.triageTier;
    const style = TIER_STYLE[tier];
    const needsDoctor = tier !== 'self_care';
    // No doctor linked yet: don't promise a call. Emergency advice stays the same either way.
    const unassigned = needsDoctor && !clinicianAlerted;
    const message = unassigned && tier !== 'emergency' ? 'result.unassigned' : `result.${tier}`;
    return (
      <div className="space-y-5" aria-live="polite">
        <div className={`rounded-3xl p-6 text-white ${style.solid}`}>
          <div className="text-5xl" aria-hidden="true">{style.icon}</div>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-white/85">{t(`tier.${tier}`)}</p>
          <h1 className="mt-1 text-3xl font-bold">{t(`${message}.title`)}</h1>
          <p className="mt-3 text-lg text-white/95">{t(`${message}.body`)}</p>
        </div>
        {clinicianAlerted && <p className="rounded-2xl bg-neem-soft px-4 py-3 font-semibold text-neem">✓ {t('result.alerted')}</p>}
        {unassigned && tier === 'emergency' && <p className="rounded-2xl bg-kumkum-soft px-4 py-3 font-semibold text-kumkum">{t('result.notAlerted')}</p>}
        <a href="tel:108" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-ink px-4 text-lg font-bold">
          🚑 {tier === 'emergency' ? t('plan.emergency') : t('result.ifWorse')}
        </a>
        <Link to="/p" className="flex min-h-12 items-center justify-center font-semibold text-ink-soft underline underline-offset-4">
          {t('result.backHome')}
        </Link>
      </div>
    );
  }

  if (step === 'severity') {
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => setStep('pick')} className="font-semibold text-ink-soft">
          ← {t('app.back')}
        </button>
        <h1 className="text-3xl font-bold">{t('report.severityTitle')}</h1>
        <div role="radiogroup" aria-label={t('report.severityTitle')} className="grid grid-cols-5 gap-2">
          {FACES.map((face, i) => {
            const value = i + 1;
            const active = severity === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSeverity(value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-3 transition-colors ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
              >
                <span className="text-3xl" aria-hidden="true">{face}</span>
                <span className="text-sm font-semibold leading-tight">{t(`severity.${value}`)}</span>
              </button>
            );
          })}
        </div>
        <div>
          <p className="mb-2 font-semibold text-ink-soft">{t('report.youChose')}</p>
          <ul className="flex flex-wrap gap-2">
            {selected.map((code) => (
              <li key={code} className="rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-line">
                <span aria-hidden="true">{SYMPTOM_ICON[code]}</span> {t(`symptom.${code}`)}
              </li>
            ))}
          </ul>
        </div>
        {send.isError && <ErrorState message={errorText(send.error)} />}
        <Button variant="danger" size="lg" className="w-full" disabled={!severity || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <><Spinner /> {t('report.sending')}</> : t('report.send')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => navigate(-1)} className="font-semibold text-ink-soft">
        ← {t('app.back')}
      </button>
      <div>
        <h1 className="text-3xl font-bold">{t('report.title')}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t('report.tapAll')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {SYMPTOMS.map((code) => {
          const active = selected.includes(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(code)}
              className={`relative flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 text-center font-semibold leading-tight transition-colors ${
                active ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/40'
              }`}
            >
              {active && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-haldi text-sm text-ink" aria-hidden="true">✓</span>}
              <span className="text-4xl" aria-hidden="true">{SYMPTOM_ICON[code]}</span>
              {t(`symptom.${code}`)}
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-20 pt-2">
        <Button size="lg" className="w-full shadow-lg" disabled={selected.length === 0} onClick={() => setStep('severity')}>
          {t('report.next')} →
        </Button>
      </div>
    </div>
  );
}
