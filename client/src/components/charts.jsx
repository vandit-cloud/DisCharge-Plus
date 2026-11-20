// Small hand-written SVG charts for the clinician dashboard (no chart library).
// Colours come from the theme tokens, so they follow the dark theme automatically.
import { useEffect, useId, useRef, useState } from 'react';
import { formatDate } from '../lib/format.js';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Counts from the previous value to `target` (from 0 on first show). Instant with reduced motion. */
export function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  const from = useRef(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (typeof target !== 'number') return undefined;
    if (prefersReducedMotion()) {
      setValue(target);
      from.current = target;
      return undefined;
    }
    const start = from.current;
    const t0 = performance.now();
    let frame;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const next = Math.round(start + (target - start) * (1 - (1 - k) ** 3));
      setValue(next);
      from.current = next;
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

export function CountUp({ value }) {
  return useCountUp(value);
}

/**
 * Single-series area chart of a daily percentage. `days` = [{ date: 'YYYY-MM-DD', percent|null }].
 * Null days are gaps (no doses were due), never drawn as 0. Hover shows a crosshair + tooltip.
 */
export function TrendChart({ days, label }) {
  const id = useId();
  const box = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 520;
  const H = 230;
  const pad = { l: 34, r: 10, t: 14, b: 26 };
  const values = days.map((d) => d.percent).filter((v) => v !== null);
  const lowest = values.length ? Math.min(...values) : 0;
  const min = Math.max(0, Math.floor((lowest - 10) / 10) * 10);
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(days.length - 1, 1);
  const y = (v) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / (100 - min || 1);

  // Split into runs of consecutive days that have a value.
  const runs = [];
  days.forEach((d, i) => {
    if (d.percent === null) return;
    const last = runs.at(-1);
    if (last && last.at(-1) === i - 1) last.push(i);
    else runs.push([i]);
  });
  const linePath = (run) => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(days[i].percent).toFixed(1)}`).join(' ');
  const areaPath = (run) => `${linePath(run)} L${x(run.at(-1)).toFixed(1)},${H - pad.b} L${x(run[0]).toFixed(1)},${H - pad.b} Z`;
  const ticks = [min, min + (100 - min) / 2, 100].map(Math.round);
  const lastIndex = days.findLastIndex((d) => d.percent !== null);

  const onMove = (event) => {
    const rect = box.current.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };

  const hovered = hover === null ? null : days[hover];
  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#63c9d6" stopOpacity="0.42" />
            <stop offset="1" stopColor="#63c9d6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth="1" />
            <text x={pad.l - 7} y={y(v) + 4} textAnchor="end" fontSize="11" className="fill-ink-soft">{v}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="11" className="fill-ink-soft">{formatDate(`${days[0].date}T00:00:00Z`, 'en', { day: 'numeric', month: 'short' })}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="11" className="fill-ink-soft">Today</text>
        {runs.map((run) => (
          <g key={run[0]}>
            <path d={areaPath(run)} fill={`url(#${id}-fill)`} className="anim-fade" />
            {run.length > 1 && (
              <path d={linePath(run)} fill="none" className="anim-draw stroke-lagoon" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength="100" />
            )}
          </g>
        ))}
        {lastIndex >= 0 && <circle cx={x(lastIndex)} cy={y(days[lastIndex].percent)} r="5" className="fill-lagoon stroke-slate" strokeWidth="2" />}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="stroke-ink-soft" strokeWidth="1" />
            {hovered.percent !== null && <circle cx={x(hover)} cy={y(hovered.percent)} r="5" className="fill-lagoon stroke-slate" strokeWidth="2" />}
          </g>
        )}
        <rect x={pad.l} y="0" width={W - pad.l - pad.r} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-slate/95 px-2.5 py-1.5 text-sm"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hovered.percent ?? 100) / H) * 100}%`, marginTop: -10 }}
          role="status"
        >
          {formatDate(`${hovered.date}T00:00:00Z`, 'en', { day: 'numeric', month: 'short' })}:{' '}
          {hovered.percent === null ? 'no doses due' : <b className="font-display">{hovered.percent}% taken</b>}
        </div>
      )}
    </div>
  );
}

/** Ring chart for a few status groups. parts = [{ key, label, n, strokeClass }]. */
export function Donut({ parts, center, centerLabel }) {
  const total = parts.reduce((sum, p) => sum + p.n, 0);
  const [shown, setShown] = useState(prefersReducedMotion());
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const gap = parts.filter((p) => p.n > 0).length > 1 ? 1.5 : 0;
  let start = 0;
  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(', ')}>
        <circle cx="50" cy="50" r="40" fill="none" className="stroke-paper" strokeWidth="13" />
        {total > 0 &&
          parts.map((p, i) => {
            const length = (p.n / total) * 100;
            const offset = -start;
            start += length;
            if (p.n === 0) return null;
            return (
              <circle
                key={p.key}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                className={p.strokeClass}
                strokeWidth="13"
                pathLength="100"
                strokeDasharray={shown ? `${Math.max(length - gap, 0)} 100` : '0 100'}
                strokeDashoffset={offset}
                style={{ transition: `stroke-dasharray 0.8s cubic-bezier(.22,1,.36,1) ${0.15 + i * 0.15}s` }}
              >
                <title>{`${p.label}: ${p.n} of ${total}`}</title>
              </circle>
            );
          })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-4xl font-extrabold leading-none tabular-nums">{center}</span>
        <span className="text-sm text-ink-soft">{centerLabel}</span>
      </div>
    </div>
  );
}
