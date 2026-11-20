/** Wordmark: a rising-sun arc over a plus, the same mark as the favicon. Colours follow the theme. */
/** `compact`: hide the word on narrow phones, where the header also holds the language switch. */
export function Logo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" {...(compact ? { role: 'img', 'aria-label': 'DisCharge+' } : { 'aria-hidden': true })}>
        <defs>
          <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#63c9d6" />
            <stop offset="1" stopColor="#1e7f8c" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#logo-tile)" />
        <path d="M14 40a18 18 0 0 1 36 0" fill="none" stroke="#fbe3a0" strokeWidth="5" strokeLinecap="round" />
        <path d="M32 22v14M25 29h14" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-xl font-bold tracking-tight text-ink ${compact ? 'hidden min-[440px]:inline' : ''}`}>DisCharge+</span>
    </span>
  );
}
