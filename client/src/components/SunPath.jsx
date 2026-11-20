import { useTranslation } from 'react-i18next';
import { SLOTS, SLOT_ICON } from '../lib/format.js';

// Today as the sun's path: the four dose times sit on an arc from sunrise to moon, and a marker
// shows "now". Someone who reads little can still see which doses are behind, due, or ahead.
// Positions along the arc are spread evenly between knots so the four stops never crowd.
const KNOTS = [
  [5 * 60, 0],
  [8 * 60, 0.12],
  [13 * 60, 0.38],
  [18 * 60, 0.64],
  [21 * 60, 0.9],
  [24 * 60, 1],
];
const SLOT_FRACTION = { morning: 0.12, afternoon: 0.38, evening: 0.64, night: 0.9 };

function fractionAt(minutes) {
  if (minutes <= KNOTS[0][0]) return 0;
  for (let i = 1; i < KNOTS.length; i += 1) {
    const [m1, f1] = KNOTS[i];
    const [m0, f0] = KNOTS[i - 1];
    if (minutes <= m1) return f0 + ((minutes - m0) / (m1 - m0)) * (f1 - f0);
  }
  return 1;
}

const CX = 160;
const BASE = 104;
const RX = 138;
const RY = 84;
const point = (f) => ({ x: CX - RX * Math.cos(Math.PI * f), y: BASE - RY * Math.sin(Math.PI * f) });
const arcTo = (f) => {
  const p = point(f);
  return `M ${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
};

function slotState(doses) {
  if (doses.length === 0) return 'empty';
  if (doses.every((d) => d.status === 'taken')) return 'done';
  if (doses.some((d) => d.canMark)) return 'due';
  if (doses.some((d) => d.status === 'missed')) return 'missed';
  return 'ahead';
}

const NODE = {
  done: { fill: '#def3e8', stroke: '#1f7a52' },
  due: { fill: '#fbf1d8', stroke: '#e0a526' },
  missed: { fill: '#fae1df', stroke: '#b3261e' },
  ahead: { fill: '#ffffff', stroke: '#9fd3de' },
  empty: { fill: '#eaf7fb', stroke: '#c6e4eb' },
};

export function SunPath({ doses, nowMinutes, onSelect }) {
  const { t } = useTranslation();
  const now = fractionAt(nowMinutes);
  const sun = point(now);

  return (
    <svg viewBox="0 0 320 150" className="w-full" role="img" aria-label={t('home.todaysMedicines')}>
      <defs>
        <linearGradient id="sunpath-trail" x1="0" x2="1">
          <stop offset="0" stopColor="#63c9d6" />
          <stop offset="1" stopColor="#1e7f8c" />
        </linearGradient>
      </defs>
      <path d={arcTo(1)} fill="none" stroke="#9fd3de" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
      <path d={arcTo(now)} fill="none" stroke="url(#sunpath-trail)" strokeWidth="5" strokeLinecap="round" className="sunpath-trail" />
      {/* "Now" marker, drawn before the stops so a stop stays readable when the sun reaches it. */}
      <g aria-hidden="true">
        <circle cx={sun.x} cy={sun.y} r="11" fill="#e0a526" opacity="0.25" />
        <circle cx={sun.x} cy={sun.y} r="6" fill="#e0a526" stroke="#fff" strokeWidth="2" />
      </g>

      {SLOTS.map((slot) => {
        const slotDoses = doses.filter((d) => d.slot === slot);
        const state = slotState(slotDoses);
        const p = point(SLOT_FRACTION[slot]);
        const taken = slotDoses.filter((d) => d.status === 'taken').length;
        const style = NODE[state];
        return (
          <g
            key={slot}
            role="button"
            tabIndex={state === 'empty' ? -1 : 0}
            aria-label={`${t(`slot.${slot}`)}: ${taken}/${slotDoses.length}`}
            onClick={() => state !== 'empty' && onSelect?.(slot)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && state !== 'empty' && onSelect?.(slot)}
            opacity={state === 'empty' ? 0.45 : 1}
            className={state === 'due' ? 'sunpath-due' : undefined}
          >
            <circle cx={p.x} cy={p.y} r="19" fill={style.fill} stroke={style.stroke} strokeWidth="3" />
            <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="17" aria-hidden="true">
              {state === 'done' ? '✓' : SLOT_ICON[slot]}
            </text>
            <text x={p.x} y={p.y + 38} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#20343a">
              {t(`slot.${slot}`)}
            </text>
            {slotDoses.length > 0 && (
              <text x={p.x} y={p.y + 53} textAnchor="middle" fontSize="11.5" fill="#3d5a61">
                {taken}/{slotDoses.length}
              </text>
            )}
          </g>
        );
      })}

    </svg>
  );
}
