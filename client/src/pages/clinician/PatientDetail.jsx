import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { EscalationRow, PageHeader, Section, symptomLabel, tierLabel } from '../../components/clinician.jsx';
import { Button, Empty, ErrorState, QueryState, RiskBadge, TierBadge } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import {
  FOLLOW_UP_ICON, PROTOCOL_LABEL, formatPhone, SLOT_ICON, SLOTS, SYMPTOM_ICON, addDaysISO, formatDate, formatDateTime,
  istDateOf, istTodayISO, medicineName,
} from '../../lib/format.js';
import { useAdherence, useDoses, useEscalations, useFollowUps, usePatient, usePlan, useSymptoms } from '../../lib/queries.js';

const TABS = ['Plan', 'Adherence', 'Symptoms', 'Escalations'];
const LANGUAGE_NAME = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };
const formatAbha = (id) => id && `${id.slice(0, 2)}-${id.slice(2, 6)}-${id.slice(6, 10)}-${id.slice(10)}`;

function useInvalidatePatient(patientId) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['plan', 'followups', 'patient', 'doses', 'adherence']) queryClient.invalidateQueries({ queryKey: [key, patientId] });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

function PlanTab({ patientId }) {
  const plan = usePlan(patientId);
  const followUps = useFollowUps(patientId);
  const invalidate = useInvalidatePatient(patientId);
  const [closeAs, setCloseAs] = useState('completed');

  const closePlan = useMutation({
    mutationFn: (planId) => api(`/plans/${planId}`, { method: 'PATCH', body: { status: closeAs } }),
    onSuccess: invalidate,
  });
  const completeFollowUp = useMutation({
    mutationFn: (followUpId) => api(`/followups/${followUpId}`, { method: 'PATCH', body: { status: 'completed' } }),
    onSuccess: invalidate,
  });

  return (
    <QueryState query={plan}>
      {({ plan: p, prescriptions }) =>
        !p ? (
          <Empty icon="📋">No discharge plan.</Empty>
        ) : (
          <div className="space-y-6">
            <Section title="Discharge plan" action={<span className="text-sm font-semibold capitalize text-ink-soft">{p.status.replaceAll('_', ' ')}</span>}>
              <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Diagnosis</dt><dd className="font-semibold">{p.primaryDiagnosis}</dd></div>
                <div><dt className="text-sm text-ink-soft">Protocol</dt><dd className="font-semibold">{PROTOCOL_LABEL[p.followUpProtocol]}</dd></div>
                <div><dt className="text-sm text-ink-soft">Admitted → discharged</dt><dd className="font-semibold">{formatDate(p.admissionDate)} → {formatDate(p.dischargeDate)}</dd></div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-sm text-ink-soft">Red flags</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {p.redFlags.map((code) => <span key={code} className="rounded-full bg-kumkum-soft px-3 py-1 text-sm font-semibold text-kumkum">{SYMPTOM_ICON[code]} {symptomLabel(code)}</span>)}
                  </dd>
                </div>
              </dl>
              {p.status === 'active' && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
                  <label htmlFor="closeAs" className="font-semibold">Close this plan as</label>
                  <select id="closeAs" value={closeAs} onChange={(e) => setCloseAs(e.target.value)} className="min-h-10 rounded-lg border border-line bg-surface px-3">
                    <option value="completed">Completed</option>
                    <option value="readmitted">Readmitted</option>
                    <option value="lost_to_followup">Lost to follow-up</option>
                  </select>
                  <Button variant="secondary" size="sm" disabled={closePlan.isPending}
                    onClick={() => window.confirm('Close this plan? Future doses will be removed and the patient can get a new plan.') && closePlan.mutate(p.planId)}>
                    Close plan
                  </Button>
                  {closePlan.isError && <span className="text-sm text-kumkum">{closePlan.error.message}</span>}
                </div>
              )}
              {p.status !== 'active' && (
                <div className="border-t border-line px-5 py-4">
                  <Link to={`/d/plans/new?patientId=${patientId}`} className="font-semibold underline underline-offset-4">Write a new plan →</Link>
                </div>
              )}
            </Section>

            <Section title="Medicines">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="text-sm text-ink-soft"><tr className="border-b border-line">
                    <th className="px-5 py-2 font-semibold">Medicine</th><th className="px-3 py-2 font-semibold">Dosage</th>
                    <th className="px-3 py-2 font-semibold">When</th><th className="px-3 py-2 text-right font-semibold">Days</th><th className="px-5 py-2 font-semibold">Critical</th>
                  </tr></thead>
                  <tbody>
                    {prescriptions.map((rx) => (
                      <tr key={rx.prescriptionId} className="border-b border-line last:border-0">
                        <td className="px-5 py-3 font-semibold">{medicineName(rx.medication)}</td>
                        <td className="px-3 py-3">{rx.dosage} · {rx.frequency}</td>
                        <td className="px-3 py-3">{SLOTS.filter((s) => rx.timingSlots.includes(s)).map((s) => SLOT_ICON[s]).join(' ')}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{rx.durationDays}</td>
                        <td className="px-5 py-3">{rx.isCritical ? <span className="font-semibold text-amber">★ Yes</span> : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Follow-ups">
              <QueryState query={followUps}>
                {(list) => (
                  <ul className="divide-y divide-line">
                    {list.map((f) => (
                      <li key={f.followUpId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="text-xl" aria-hidden="true">{FOLLOW_UP_ICON[f.type]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{f.description}</p>
                          <p className="text-sm text-ink-soft">{formatDate(f.scheduledDate)}{f.completedDate && ` · done ${formatDate(f.completedDate)}`}</p>
                        </div>
                        {f.status === 'completed' && <span className="font-semibold text-neem">✓ Done</span>}
                        {f.status === 'scheduled' && (
                          <>
                            {f.overdue && <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-sm font-semibold text-clay">Overdue</span>}
                            {p.status === 'active' && (
                              <Button variant="secondary" size="sm" disabled={completeFollowUp.isPending} onClick={() => completeFollowUp.mutate(f.followUpId)}>
                                Mark done
                              </Button>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </QueryState>
              {completeFollowUp.isError && <div className="p-5"><ErrorState message={completeFollowUp.error.message} /></div>}
            </Section>
          </div>
        )
      }
    </QueryState>
  );
}

const DOT = { taken: 'bg-neem', missed: 'bg-kumkum', pending: 'bg-line' };

function AdherenceTab({ patientId }) {
  const today = istTodayISO();
  const from = addDaysISO(today, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i));
  const adherence = useAdherence(patientId);
  const plan = usePlan(patientId);
  const doses = useDoses(patientId, { from, to: today });
  const pct = (value) => (value === null ? '–' : `${value}%`);

  return (
    <div className="space-y-6">
      <QueryState query={adherence}>
        {(a) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Whole plan"><p className="px-5 py-4"><span className="font-display text-4xl font-bold">{pct(a.percent)}</span> <span className="text-ink-soft">{a.taken} taken · {a.missed} missed</span></p></Section>
            <Section title="Last 7 days"><p className="px-5 py-4"><span className="font-display text-4xl font-bold">{pct(a.last7Days.percent)}</span> <span className="text-ink-soft">{a.last7Days.taken} taken · {a.last7Days.missed} missed</span></p></Section>
          </div>
        )}
      </QueryState>
      <Section title="Doses, last 7 days" action={<span className="flex gap-3 text-sm text-ink-soft"><span><i className="mr-1 inline-block size-2.5 rounded-full bg-neem" />taken</span><span><i className="mr-1 inline-block size-2.5 rounded-full bg-kumkum" />missed</span><span><i className="mr-1 inline-block size-2.5 rounded-full bg-line" />pending</span></span>}>
        {plan.data?.prescriptions && doses.data ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-ink-soft"><tr className="border-b border-line">
                <th className="px-5 py-2 font-semibold">Medicine</th>
                {days.map((d) => <th key={d} className="px-2 py-2 text-center font-semibold">{formatDate(`${d}T00:00:00Z`, 'en', { weekday: 'short', day: 'numeric' })}</th>)}
              </tr></thead>
              <tbody>
                {plan.data.prescriptions.map((rx) => (
                  <tr key={rx.prescriptionId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold">{medicineName(rx.medication)} {rx.isCritical && <span className="text-amber">★</span>}</td>
                    {days.map((day) => (
                      <td key={day} className="px-2 py-3">
                        <div className="flex justify-center gap-1">
                          {doses.data.filter((d) => d.prescriptionId === rx.prescriptionId && istDateOf(d.scheduledAt) === day).map((d) => (
                            <span key={d.adherenceId} className={`size-3 rounded-full ${DOT[d.status]}`} title={`${d.slot}: ${d.status}`} />
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-ink-soft">Loading…</p>
        )}
      </Section>
    </div>
  );
}

function SymptomsTab({ patientId }) {
  const symptoms = useSymptoms(patientId);
  return (
    <QueryState query={symptoms}>
      {(logs) =>
        logs.length === 0 ? (
          <Empty icon="🩺">No symptom reports.</Empty>
        ) : (
          <Section title="All reports, including self-care (kept to audit the rules)">
            <ul className="divide-y divide-line">
              {logs.map((log) => (
                <li key={log.symptomLogId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                  <span className="w-32 shrink-0 text-sm tabular-nums text-ink-soft">{formatDateTime(log.reportedAt)}</span>
                  <span className="min-w-0 flex-1">
                    {log.symptoms.map((c) => `${SYMPTOM_ICON[c]} ${symptomLabel(c)}`).join(', ')} · severity {log.severity}
                    {log.reasons.length > 0 && <span className="block text-sm text-ink-soft">{log.reasons.join(' · ')}</span>}
                  </span>
                  <TierBadge tier={log.triageTier} label={tierLabel(log.triageTier)} />
                </li>
              ))}
            </ul>
          </Section>
        )
      }
    </QueryState>
  );
}

function EscalationsTab({ patientId }) {
  const escalations = useEscalations({ patientId, status: 'open,acknowledged,resolved' });
  return (
    <QueryState query={escalations}>
      {(list) =>
        list.length === 0 ? (
          <Empty icon="✓">No escalations.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {list.map((e) => <EscalationRow key={e.escalationId} escalation={e} showPatient={false} />)}
          </ul>
        )
      }
    </QueryState>
  );
}

export default function PatientDetail() {
  const { patientId } = useParams();
  const location = useLocation();
  const patient = usePatient(patientId);
  const [tab, setTab] = useState('Plan');

  return (
    <QueryState query={patient}>
      {(p) => (
        <>
          <PageHeader
            back={{ to: '/d/patients', label: 'Patients' }}
            title={p.fullName}
            subtitle={[`${p.age} y`, p.gender, p.district, LANGUAGE_NAME[p.preferredLanguage], p.abhaId && `ABHA ${formatAbha(p.abhaId)}`].filter(Boolean).join(' · ')}
            actions={<a href={`tel:${p.phone}`} className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold">📞 {formatPhone(p.phone)}</a>}
          />
          {location.state?.message && <p className="mb-4 rounded-xl bg-neem-soft px-4 py-3 font-semibold text-neem">{location.state.message}</p>}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
            <RiskBadge band={p.riskBand} />
            <span className="text-ink-soft">{!p.riskBand ? 'Risk is tracked only while a plan is active' : p.riskReasons.length ? p.riskReasons.join(' · ') : 'No risk factors right now'}</span>
          </div>
          <div role="tablist" aria-label="Patient record" className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
            {TABS.map((name) => (
              <button
                key={name}
                role="tab"
                type="button"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`-mb-px min-h-11 whitespace-nowrap border-b-3 px-4 font-semibold ${tab === name ? 'border-lagoon text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'Plan' && <PlanTab patientId={patientId} />}
            {tab === 'Adherence' && <AdherenceTab patientId={patientId} />}
            {tab === 'Symptoms' && <SymptomsTab patientId={patientId} />}
            {tab === 'Escalations' && <EscalationsTab patientId={patientId} />}
          </div>
        </>
      )}
    </QueryState>
  );
}
