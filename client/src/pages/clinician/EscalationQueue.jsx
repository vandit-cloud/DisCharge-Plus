import { useState } from 'react';
import { EscalationRow, PageHeader, Segmented } from '../../components/clinician.jsx';
import { Empty, QueryState } from '../../components/ui.jsx';
import { useEscalations } from '../../lib/queries.js';

const STATUS_OPTIONS = [
  { value: 'open,acknowledged', label: 'Needs action' },
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];
const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'teleconsult', label: 'Teleconsult' },
];

export default function EscalationQueue() {
  const [status, setStatus] = useState('open,acknowledged');
  const [tier, setTier] = useState('');
  const escalations = useEscalations({ status, tier: tier || undefined });

  return (
    <>
      <PageHeader title="Escalations" subtitle="Highest tier first, then oldest first. Refreshes every 30 seconds." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <Segmented label="Tier" options={TIER_OPTIONS} value={tier} onChange={setTier} />
      </div>
      <QueryState query={escalations}>
        {(list) =>
          list.length === 0 ? (
            <Empty icon="✓">No escalations match these filters.</Empty>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {list.map((e) => <EscalationRow key={e.escalationId} escalation={e} />)}
            </ul>
          )
        }
      </QueryState>
    </>
  );
}
