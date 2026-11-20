import { useTranslation } from 'react-i18next';
import { RISK_STYLE, TIER_STYLE } from '../lib/format.js';

const BUTTON = {
  primary: 'bg-brand text-on-brand hover:bg-brand/90',
  danger: 'bg-kumkum text-on-danger hover:bg-kumkum/90',
  success: 'bg-neem text-on-success hover:bg-neem/90',
  secondary: 'bg-surface text-ink border border-line hover:border-ink/40',
  ghost: 'text-ink hover:bg-ink/5',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const sizes = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-12 px-5', lg: 'min-h-14 px-6 text-lg' };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${BUTTON[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputClass =
  'block w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-ink-soft/60 focus:border-brand focus:outline-none aria-[invalid=true]:border-kumkum';

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-medium text-kumkum" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-ink-soft">{hint}</p>
      )}
    </div>
  );
}

export function Card({ className = '', ...props }) {
  return <div className={`card-shadow rounded-3xl border border-line bg-surface ${className}`} {...props} />;
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-soft" role="status">
      <Spinner /> {t('app.loading')}
    </div>
  );
}

export function ErrorState({ onRetry, message }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-kumkum/30 bg-kumkum-soft p-5 text-kumkum" role="alert">
      <p className="font-medium">{message ?? t('app.error')}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          {t('app.retry')}
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / content for a TanStack query. */
export function QueryState({ query, children }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} message={query.error.status === 403 ? query.error.message : undefined} />;
  return children(query.data);
}

export function Empty({ icon, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-ink-soft">
      {icon && <div className="mb-2 text-3xl" aria-hidden="true">{icon}</div>}
      {children}
    </div>
  );
}

export function TierBadge({ tier, label }) {
  const style = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${style.bg} ${style.text}`}>
      <span aria-hidden="true">{style.icon}</span>
      {label}
    </span>
  );
}

export function RiskBadge({ band }) {
  if (!band) return <span className="inline-flex rounded-full bg-paper px-2.5 py-0.5 text-sm font-semibold text-ink-soft">No active plan</span>;
  const style = RISK_STYLE[band];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${style.bg} ${style.text}`}>
      <span className={`size-2 rounded-full ${style.solid}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
