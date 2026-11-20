import { useDeferredValue, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader, Segmented } from '../../components/clinician.jsx';
import { Empty, QueryState, RiskBadge, inputClass } from '../../components/ui.jsx';
import { formatPhone } from '../../lib/format.js';
import { usePatients } from '../../lib/queries.js';

const RISK_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
];

export default function PatientList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const patients = usePatients({ search: deferredSearch || undefined, risk: risk || undefined });

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Patients you have written a discharge plan for, highest risk first."
        actions={<Link to="/d/plans/new" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-on-brand">+ New plan</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone or ABHA"
          aria-label="Search patients"
          className={`${inputClass} max-w-sm`}
        />
        <Segmented label="Risk" options={RISK_OPTIONS} value={risk} onChange={setRisk} />
      </div>
      <QueryState query={patients}>
        {(list) =>
          list.length === 0 ? (
            <Empty icon="🔍">No patients match. To add a new patient, write their first plan with “New plan”.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[720px] text-left">
                <thead className="text-sm text-ink-soft">
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-semibold">Patient</th>
                    <th className="px-3 py-3 font-semibold">Diagnosis</th>
                    <th className="px-3 py-3 text-right font-semibold">Day</th>
                    <th className="px-3 py-3 text-right font-semibold">Adherence</th>
                    <th className="px-3 py-3 font-semibold">Risk</th>
                    <th className="px-5 py-3 text-right font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr
                      key={p.patientId}
                      onClick={() => navigate(`/d/patients/${p.patientId}`)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                    >
                      <td className="px-5 py-3">
                        <Link to={`/d/patients/${p.patientId}`} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                          {p.fullName}
                        </Link>
                        <p className="text-sm tabular-nums text-ink-soft">{formatPhone(p.phone)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-xs truncate">{p.plan?.primaryDiagnosis ?? '–'}</p>
                        {p.plan && p.plan.status !== 'active' && <p className="text-sm capitalize text-ink-soft">{p.plan.status.replaceAll('_', ' ')}</p>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.daysSinceDischarge ?? '–'}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.adherencePercent === null ? '–' : `${p.adherencePercent}%`}</td>
                      <td className="px-3 py-3"><RiskBadge band={p.riskBand} /></td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.openEscalations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryState>
    </>
  );
}
