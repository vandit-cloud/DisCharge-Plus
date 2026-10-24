/** Wordmark: a rising-sun arc over a plus, the same mark as the favicon. */
export function Logo({ inverted = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={inverted ? '#ffffff' : '#1e2a5a'} />
        <path d="M14 40a18 18 0 0 1 36 0" fill="none" stroke="#e0a526" strokeWidth="5" strokeLinecap="round" />
        <path d="M32 22v14M25 29h14" stroke={inverted ? '#1e2a5a' : '#ffffff'} strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-xl font-bold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`}>
        DisCharge<span className="text-haldi">+</span>
      </span>
    </span>
  );
}
