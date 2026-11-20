import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader, Section, StatusPill, symptomLabel, tierLabel } from '../../components/clinician.jsx';
import { Button, ErrorState, QueryState, Spinner, TierBadge } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { PROTOCOL_LABEL, SYMPTOM_ICON, formatPhone, formatDate, formatDateTime, medicineName, timeAgo } from '../../lib/format.js';
import { useEscalation } from '../../lib/queries.js';

function Source({ escalation: e }) {
  if (e.symptomLog) {
    const log = e.symptomLog;
    return (
      <div className="space-y-3 p-5">
        <ul className="flex flex-wrap gap-2">
          {log.symptoms.map((code) => (
            <li key={code} className="rounded-full bg-paper px-3 py-1.5 font-semibold">
              <span aria-hidden="true">{SYMPTOM_ICON[code]}</span> {symptomLabel(code)}
            </li>
          ))}
        </ul>
        <p>Severity <strong className="tabular-nums">{log.severity} / 5</strong></p>
        <p className="text-sm text-ink-soft">Reported {formatDateTime(log.reportedAt)}</p>
      </div>
    );
  }
  if (e.dose) {
    const rx = e.dose.prescription;
    return (
      <div className="space-y-2 p-5">
        <p className="text-lg font-semibold">💊 {medicineName(rx?.medication)} · {rx?.dosage}</p>
        <p>Due {formatDateTime(e.dose.scheduledAt)}, not marked as taken within the grace window.</p>
        <p className="text-sm text-ink-soft">Marked critical in the discharge plan.</p>
      </div>
    );
  }
  return <p className="p-5 text-ink-soft">Source record not found.</p>;
}

export default function EscalationDetail() {
  const { escalationId } = useParams();
  const escalation = useEscalation(escalationId);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const act = useMutation({
    mutationFn: (action) =>
      api(`/escalations/${escalationId}/${action}`, { method: 'PATCH', body: action === 'resolve' ? { notes } : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation', escalationId] });
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <QueryState query={escalation}>
      {(e) => (
        <>
          <PageHeader
            back={{ to: '/d/escalations', label: 'Escalations' }}
            title={e.patient?.fullName ?? 'Escalation'}
            subtitle={
              <span className="flex flex-wrap items-center gap-2">
                <TierBadge tier={e.tier} label={tierLabel(e.tier)} />
                <StatusPill status={e.status} />
                <span>raised {timeAgo(e.createdAt)} ({formatDateTime(e.createdAt)})</span>
              </span>
            }
            actions={
              <>
                {e.patient?.phone && <a href={`tel:${e.patient.phone}`} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold">📞 {formatPhone(e.patient.phone)}</a>}
                <Link to={`/d/patients/${e.patientId}`} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold">View patient →</Link>
              </>
            }
          />

          {e.plan && (
            <p className="mb-6 text-ink-soft">
              {e.plan.primaryDiagnosis} · {PROTOCOL_LABEL[e.plan.followUpProtocol]} protocol · discharged {formatDate(e.plan.dischargeDate)} (day {e.plan.daysSinceDischarge})
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title={e.source === 'missed_critical_dose' ? 'Missed dose' : 'What was reported'}>
              <Source escalation={e} />
            </Section>
            <Section title="Why it was raised">
              <ul className="space-y-3 p-5">
                {e.triggeredRules.map((id, i) => (
                  <li key={id}>
                    <p className="font-semibold">{e.reasons[i]}</p>
                    <p className="font-mono text-sm text-ink-soft">{id}</p>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section title="Action" className="mt-6">
            <div className="space-y-4 p-5">
              {e.status === 'open' && (
                <>
                  <p>Acknowledge to show the team you are handling it. Then contact the patient and record what you did.</p>
                  <Button onClick={() => act.mutate('acknowledge')} disabled={act.isPending}>
                    {act.isPending && <Spinner />} Acknowledge
                  </Button>
                </>
              )}
              {e.status === 'acknowledged' && (
                <>
                  <p className="text-ink-soft">Acknowledged {formatDateTime(e.acknowledgedAt)}.</p>
                  <label htmlFor="notes" className="block font-semibold">What was done (required to resolve)</label>
                  <textarea
                    id="notes"
                    rows={4}
                    maxLength={1000}
                    value={notes}
                    onChange={(ev) => setNotes(ev.target.value)}
                    className="block w-full rounded-xl border border-line p-3 focus:border-brand focus:outline-none"
                    placeholder="e.g. Called the patient, advised to come to OPD today"
                  />
                  <Button variant="success" onClick={() => act.mutate('resolve')} disabled={act.isPending || !notes.trim()}>
                    {act.isPending && <Spinner />} Resolve
                  </Button>
                </>
              )}
              {e.status === 'resolved' && (
                <div className="space-y-1">
                  <p className="text-ink-soft">
                    Acknowledged {formatDateTime(e.acknowledgedAt)} · resolved {formatDateTime(e.resolvedAt)}
                  </p>
                  <p className="whitespace-pre-line rounded-xl bg-paper p-4">{e.notes}</p>
                </div>
              )}
              {act.isError && <ErrorState message={act.error.message} />}
            </div>
          </Section>
        </>
      )}
    </QueryState>
  );
}
