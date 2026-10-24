/**
 * Rule-based risk band for the dashboard (decision D11). Computed on request, never stored.
 * This is the single hook a future ML model would replace.
 *
 * Points:
 *   adherence below 60%        +2      adherence 60-79%          +1
 *   2 or more open escalations +2      1 open escalation         +1
 *   first 7 days after discharge +1   (readmission risk is highest early on)
 *   any open EMERGENCY escalation +3   (always high until a clinician resolves it)
 * Band: 3+ points = high, 1-2 = moderate, 0 = low.
 * Adherence is null when no dose has fallen due yet; it then adds no points.
 *
 * @param {{ adherencePercent: number|null, openEscalations: number, openEmergencies?: number,
 *           daysSinceDischarge: number|null }} stats
 * @returns {{ band: 'low'|'moderate'|'high', score: number, reasons: string[] }}
 */
export function computeRiskBand({ adherencePercent, openEscalations, openEmergencies = 0, daysSinceDischarge }) {
  let points = 0;
  const reasons = [];

  if (adherencePercent !== null && adherencePercent < 60) {
    points += 2;
    reasons.push(`Adherence ${adherencePercent}% (below 60%)`);
  } else if (adherencePercent !== null && adherencePercent < 80) {
    points += 1;
    reasons.push(`Adherence ${adherencePercent}% (below 80%)`);
  }

  if (openEscalations >= 2) {
    points += 2;
    reasons.push(`${openEscalations} open escalations`);
  } else if (openEscalations === 1) {
    points += 1;
    reasons.push('1 open escalation');
  }

  if (openEmergencies > 0) {
    points += 3;
    reasons.push('Open emergency escalation');
  }

  if (daysSinceDischarge !== null && daysSinceDischarge >= 0 && daysSinceDischarge <= 7) {
    points += 1;
    reasons.push(`Day ${daysSinceDischarge} after discharge (first week)`);
  }

  const band = points >= 3 ? 'high' : points >= 1 ? 'moderate' : 'low';
  return { band, score: points, reasons };
}
