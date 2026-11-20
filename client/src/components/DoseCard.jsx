import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { formatTime, medicineName } from '../lib/format.js';
import { useErrorText } from '../lib/useErrorText.js';
import { Spinner } from './ui.jsx';

/** One scheduled dose with a big "I took it" button (FR-3.2). Marks optimistically. */
export function DoseCard({ dose, queryKey }) {
  const { t, i18n } = useTranslation();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const { prescription } = dose;

  const mark = useMutation({
    mutationFn: () => api(`/doses/${dose.adherenceId}`, { method: 'PATCH', body: { status: 'taken' } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (doses) =>
        doses?.map((d) => (d.adherenceId === dose.adherenceId ? { ...d, status: 'taken', canMark: false, recordedAt: new Date().toISOString() } : d)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(queryKey, context.previous),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['doses'] });
      queryClient.invalidateQueries({ queryKey: ['adherence'] });
    },
  });

  const status = dose.status;
  return (
    <li className={`rounded-2xl border bg-surface p-4 ${status === 'taken' ? 'border-neem/30' : 'border-line'}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper text-2xl" aria-hidden="true">
          {prescription.medication.form === 'injection' ? '💉' : prescription.medication.form === 'syrup' ? '🧴' : '💊'}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold leading-snug ${status === 'missed' ? 'text-ink-soft line-through decoration-1' : ''}`}>
            {medicineName(prescription.medication)}
          </p>
          <p className="text-sm text-ink-soft">
            {prescription.dosage} · {formatTime(dose.scheduledAt, i18n.language)}
          </p>
          {prescription.isCritical && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-haldi-soft px-2 py-0.5 text-sm font-semibold text-amber">
              ★ {t('medicines.critical')}
            </p>
          )}
        </div>

        {status === 'taken' && (
          <span className="flex min-h-12 items-center gap-1.5 rounded-xl bg-neem-soft px-3 font-semibold text-neem">
            <span aria-hidden="true">✓</span> {t('home.taken')}
          </span>
        )}
        {status === 'missed' && <span className="px-2 font-semibold text-kumkum">{t('home.missed')}</span>}
        {status === 'pending' && dose.canMark && (
          <button
            type="button"
            onClick={() => mark.mutate()}
            disabled={mark.isPending}
            className="flex min-h-12 min-w-28 items-center justify-center gap-1.5 rounded-xl bg-neem px-4 font-semibold text-on-success hover:bg-neem/90"
          >
            {mark.isPending ? <Spinner /> : <span aria-hidden="true">✓</span>} {t('home.markTaken')}
          </button>
        )}
        {status === 'pending' && !dose.canMark && <span className="px-2 text-ink-soft">{t('home.later')}</span>}
      </div>
      {mark.isError && (
        <p className="mt-2 text-sm font-medium text-kumkum" role="alert">
          {errorText(mark.error)}
        </p>
      )}
    </li>
  );
}
