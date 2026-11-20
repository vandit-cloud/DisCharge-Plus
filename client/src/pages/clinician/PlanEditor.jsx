import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader, Section, symptomLabel } from '../../components/clinician.jsx';
import { Button, ErrorState, Field, Spinner, inputClass } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { PROTOCOL_LABEL, SLOT_ICON, SLOTS, SYMPTOM_ICON, formatPhone, istTodayISO } from '../../lib/format.js';
import { useMeta, usePatient } from '../../lib/queries.js';

const FREQUENCY_SLOTS = {
  OD: ['morning'],
  BD: ['morning', 'night'],
  TDS: ['morning', 'afternoon', 'night'],
  QID: ['morning', 'afternoon', 'evening', 'night'],
};
const newLine = () => ({ key: crypto.randomUUID(), medicationId: '', dosage: '1 tablet', frequency: 'OD', timingSlots: ['morning'], durationDays: 30, isCritical: false });

/** Step 0: find the patient (exact phone or ABHA), unless we arrived with ?patientId. */
function PatientPicker({ onPick }) {
  const [q, setQ] = useState('');
  const lookup = useMutation({ mutationFn: () => api('/patients/lookup', { query: { q } }).then((r) => r.patient) });
  const found = lookup.data;
  return (
    <Section title="1 · Patient">
      <form className="flex flex-wrap items-end gap-3 p-5" onSubmit={(e) => { e.preventDefault(); lookup.mutate(); }}>
        <div className="min-w-64 flex-1">
          <Field label="Mobile number or ABHA ID" htmlFor="lookup" hint="The patient registers in the app first; then find them here.">
            <input id="lookup" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="98765 43210" />
          </Field>
        </div>
        <Button type="submit" disabled={q.trim().length < 3 || lookup.isPending}>{lookup.isPending && <Spinner />} Find</Button>
      </form>
      {lookup.isError && <div className="px-5 pb-5"><ErrorState message={lookup.error.status === 404 ? 'No patient with that number. Ask them to register first.' : lookup.error.message} /></div>}
      {found && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <div>
            <p className="text-lg font-semibold">{found.fullName}</p>
            <p className="text-ink-soft">{found.age} y · {found.gender} · {found.district} · {formatPhone(found.phone)}</p>
          </div>
          {found.hasActivePlan ? (
            <p className="font-semibold text-clay">Already has an active plan. Close it first on the patient's page.</p>
          ) : (
            <Button onClick={() => onPick(found)}>Write plan for {found.fullName.split(' ')[0]}</Button>
          )}
        </div>
      )}
    </Section>
  );
}

function PrescriptionRow({ line, index, medications, error, onChange, onRemove, canRemove }) {
  const set = (patch) => onChange({ ...line, ...patch });
  const toggleSlot = (slot) =>
    set({ timingSlots: line.timingSlots.includes(slot) ? line.timingSlots.filter((s) => s !== slot) : [...line.timingSlots, slot] });
  const needed = FREQUENCY_SLOTS[line.frequency].length;
  const slotsOk = line.timingSlots.length === needed;
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_0.7fr]">
        <label className="space-y-1"><span className="text-sm font-semibold">Medicine {index + 1}</span>
          <select value={line.medicationId} onChange={(e) => set({ medicationId: e.target.value })} className={inputClass} aria-invalid={!line.medicationId && Boolean(error)}>
            <option value="">Choose…</option>
            {medications.map((m) => <option key={m.medicationId} value={m.medicationId}>{m.genericName} {m.strength} ({m.form})</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-sm font-semibold">Dosage</span>
          <input value={line.dosage} maxLength={40} onChange={(e) => set({ dosage: e.target.value })} className={inputClass} />
        </label>
        <label className="space-y-1"><span className="text-sm font-semibold">Frequency</span>
          <select value={line.frequency} onChange={(e) => set({ frequency: e.target.value, timingSlots: FREQUENCY_SLOTS[e.target.value] })} className={inputClass}>
            {Object.keys(FREQUENCY_SLOTS).map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-sm font-semibold">Days</span>
          <input type="number" min={1} max={365} value={line.durationDays} onChange={(e) => set({ durationDays: e.target.value === '' ? '' : Number(e.target.value) })} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">When:</span>
        {SLOTS.map((slot) => (
          <button key={slot} type="button" aria-pressed={line.timingSlots.includes(slot)} onClick={() => toggleSlot(slot)}
            className={`min-h-9 rounded-full border px-3 text-sm font-semibold capitalize ${line.timingSlots.includes(slot) ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-ink-soft'}`}>
            {SLOT_ICON[slot]} {slot}
          </button>
        ))}
        {!slotsOk && <span className="text-sm font-medium text-kumkum">{line.frequency} needs {needed} time(s)</span>}
        <label className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-haldi-soft px-3 text-sm font-semibold text-amber">
          <input type="checkbox" checked={line.isCritical} onChange={(e) => set({ isCritical: e.target.checked })} className="size-4 accent-[#e0a526]" />
          ★ Critical (a missed dose alerts you)
        </label>
        {canRemove && <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove medicine ${index + 1}`}>Remove</Button>}
      </div>
      {error && <p className="text-sm font-medium text-kumkum">{error}</p>}
    </li>
  );
}

function NewMedicine({ onCreated }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ genericName: '', form: 'tablet', strength: '' });
  const create = useMutation({
    mutationFn: () => api('/medications', { method: 'POST', body: form }).then((r) => r.medication),
    onSuccess: (medication) => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      onCreated(medication);
      setOpen(false);
      setForm({ genericName: '', form: 'tablet', strength: '' });
    },
  });
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Not in the list? Add a medicine</Button>;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-paper p-3">
      <input aria-label="Generic name" placeholder="Generic name" value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} className={`${inputClass} max-w-56`} />
      <select aria-label="Form" value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} className={`${inputClass} max-w-36`}>
        {['tablet', 'capsule', 'syrup', 'injection'].map((f) => <option key={f}>{f}</option>)}
      </select>
      <input aria-label="Strength" placeholder="e.g. 500 mg" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} className={`${inputClass} max-w-36`} />
      <Button size="sm" disabled={!form.genericName.trim() || !form.strength.trim() || create.isPending} onClick={() => create.mutate()}>Add</Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      {create.isError && <p className="w-full text-sm text-kumkum">{create.error.message}</p>}
    </div>
  );
}

export default function PlanEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const known = usePatient(params.get('patientId'));
  const meta = useMeta();
  const medications = useQuery({ queryKey: ['medications'], queryFn: () => api('/medications').then((r) => r.medications) });
  const [patient, setPatient] = useState(null);
  const today = istTodayISO();
  const [form, setForm] = useState({ admissionDate: '', dischargeDate: today, primaryDiagnosis: '', followUpProtocol: 'cardiac', redFlags: [] });
  const [lines, setLines] = useState([newLine()]);
  // After the first save attempt, field errors update live as the form is corrected.
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  useEffect(() => {
    if (known.data && !patient) setPatient(known.data);
  }, [known.data, patient]);
  // A server field error is about what was sent; once the form changes, it no longer applies.
  useEffect(() => setServerErrors({}), [form, lines]);
  // Pre-tick the protocol's usual red flags whenever the protocol changes.
  useEffect(() => {
    const defaults = meta.data?.protocols[form.followUpProtocol]?.defaultRedFlags;
    if (defaults) setForm((f) => ({ ...f, redFlags: defaults }));
  }, [meta.data, form.followUpProtocol]);

  const save = useMutation({
    mutationFn: (body) => api('/plans', { method: 'POST', body }),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      navigate(`/d/patients/${patient.patientId}`, {
        state: { message: `Plan saved: ${result.generated.followUps} follow-ups and ${result.generated.doses} doses scheduled.` },
      });
    },
    onError: (err) => setServerErrors(err.fields ?? {}),
  });

  function check() {
    const found = {};
    if (!form.admissionDate) found.admissionDate = 'Required';
    if (!form.dischargeDate) found.dischargeDate = 'Required';
    else if (form.dischargeDate > today) found.dischargeDate = 'Cannot be in the future';
    else if (form.admissionDate && form.dischargeDate < form.admissionDate) found.dischargeDate = 'Must be on or after admission';
    if (form.primaryDiagnosis.trim().length < 3) found.primaryDiagnosis = 'Enter the diagnosis';
    if (form.redFlags.length === 0) found.redFlags = 'Choose at least one red flag';
    lines.forEach((line, i) => {
      if (!line.medicationId) found[`prescriptions.${i}`] = 'Choose a medicine';
      else if (line.timingSlots.length !== FREQUENCY_SLOTS[line.frequency].length) found[`prescriptions.${i}`] = 'Timing slots must match the frequency';
      else if (!Number.isInteger(line.durationDays) || line.durationDays < 1 || line.durationDays > 365) found[`prescriptions.${i}`] = 'Days must be 1 to 365';
      else if (!line.dosage.trim()) found[`prescriptions.${i}`] = 'Enter the dosage';
    });
    return found;
  }

  const errors = attempted ? { ...serverErrors, ...check() } : {};

  function submit() {
    setAttempted(true);
    setServerErrors({});
    if (Object.keys(check()).length) return;
    save.mutate({
      patientId: patient.patientId,
      ...form,
      prescriptions: lines.map(({ key, ...line }) => line),
    });
  }

  const lineError = (i) => errors[`prescriptions.${i}`] ?? Object.entries(errors).find(([k]) => k.startsWith(`prescriptions.${i}.`))?.[1];
  const doseEstimate = lines.reduce((sum, l) => sum + l.timingSlots.length * (Number(l.durationDays) || 0), 0);
  const followUpCount = meta.data?.protocols[form.followUpProtocol]?.followUps ?? 0;

  return (
    <>
      <PageHeader title="New discharge plan" subtitle="Saving creates the follow-up schedule and every dose automatically." />
      {!patient ? (
        params.get('patientId') && known.isPending ? <p className="text-ink-soft">Loading patient…</p> : <PatientPicker onPick={setPatient} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
            <p><span className="text-ink-soft">Patient:</span> <strong>{patient.fullName}</strong> · {formatPhone(patient.phone)}</p>
            {!params.get('patientId') && <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change patient</Button>}
          </div>

          <Section title="1 · Admission">
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <Field label="Admission date" htmlFor="admissionDate" error={errors.admissionDate}>
                <input id="admissionDate" type="date" max={today} value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.admissionDate)} />
              </Field>
              <Field label="Discharge date" htmlFor="dischargeDate" error={errors.dischargeDate}>
                <input id="dischargeDate" type="date" max={today} value={form.dischargeDate} onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.dischargeDate)} />
              </Field>
              <div className="md:col-span-3">
                <Field label="Primary diagnosis" htmlFor="primaryDiagnosis" error={errors.primaryDiagnosis}>
                  <input id="primaryDiagnosis" maxLength={200} value={form.primaryDiagnosis} onChange={(e) => setForm({ ...form, primaryDiagnosis: e.target.value })} className={inputClass} placeholder="e.g. Heart failure with type 2 diabetes" aria-invalid={Boolean(errors.primaryDiagnosis)} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="2 · Medicines" action={<span className="text-sm text-ink-soft">{lines.length} prescribed</span>}>
            {medications.isError && <div className="p-5"><ErrorState onRetry={() => medications.refetch()} /></div>}
            <ul className="divide-y divide-line">
              {lines.map((line, i) => (
                <PrescriptionRow
                  key={line.key}
                  line={line}
                  index={i}
                  medications={medications.data ?? []}
                  error={lineError(i)}
                  canRemove={lines.length > 1}
                  onChange={(next) => setLines((all) => all.map((l) => (l.key === line.key ? next : l)))}
                  onRemove={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
              <Button variant="secondary" size="sm" onClick={() => setLines((all) => [...all, newLine()])} disabled={lines.length >= 20}>+ Add medicine</Button>
              <NewMedicine
                onCreated={(m) =>
                  setLines((all) => {
                    // Put the new medicine on the first line without one; never overwrite a chosen medicine.
                    const empty = all.findIndex((l) => !l.medicationId);
                    return empty === -1
                      ? [...all, { ...newLine(), medicationId: m.medicationId }]
                      : all.map((l, i) => (i === empty ? { ...l, medicationId: m.medicationId } : l));
                  })
                }
              />
            </div>
          </Section>

          <Section title="3 · Red flags and follow-up protocol">
            <div className="space-y-5 p-5">
              <fieldset>
                <legend className="mb-2 font-semibold">Follow-up protocol</legend>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(PROTOCOL_LABEL).map((p) => (
                    <label key={p} className={`inline-flex min-h-10 cursor-pointer items-center rounded-xl border px-4 font-semibold ${form.followUpProtocol === p ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}>
                      <input type="radio" name="protocol" value={p} checked={form.followUpProtocol === p} onChange={() => setForm({ ...form, followUpProtocol: p })} className="sr-only" />
                      {PROTOCOL_LABEL[p]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 font-semibold">Red flags <span className="font-normal text-ink-soft">(shown to the patient; any of them reported raises an alert)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {(meta.data?.symptomCodes ?? []).map((code) => {
                    const on = form.redFlags.includes(code);
                    return (
                      <button key={code} type="button" aria-pressed={on}
                        onClick={() => setForm({ ...form, redFlags: on ? form.redFlags.filter((c) => c !== code) : [...form.redFlags, code] })}
                        className={`min-h-10 rounded-full border px-3 font-semibold ${on ? 'border-kumkum bg-kumkum-soft text-kumkum' : 'border-line bg-surface text-ink-soft'}`}>
                        {SYMPTOM_ICON[code]} {symptomLabel(code)}
                      </button>
                    );
                  })}
                </div>
                {errors.redFlags && <p className="mt-2 text-sm font-medium text-kumkum">{errors.redFlags}</p>}
              </fieldset>
            </div>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-4 text-on-brand">
            <p>Saving will schedule <strong>{followUpCount} follow-ups</strong> and up to <strong>{doseEstimate} doses</strong> (doses already past are skipped).</p>
            <Button variant="secondary" onClick={submit} disabled={save.isPending}>{save.isPending && <Spinner />} Save plan</Button>
          </div>
          {save.isError && <ErrorState message={save.error.message} />}
        </div>
      )}
    </>
  );
}
