// Follow-up no-show model (logistic regression). The weights are trained in Python by
// ml/train_noshow.py and saved to noshow-model.json; here we only apply them, so the
// server needs no Python. Computed on read, never stored.
//
// Trained on public data (Kaggle "Medical Appointment No Shows", Brazil 2016, CC BY-NC-SA 4.0).
// It is outreach decision support, "whom to phone first", not a clinical prediction.
import model from './noshow-model.json' with { type: 'json' };

export const NO_SHOW_MODEL = model;

/**
 * Maps what our app stores onto the model's five inputs.
 * The dataset has no "other" gender and no protocols, so:
 *   male         = 1 only for 'male'
 *   hypertension = cardiac protocol (closest match), diabetes = diabetes protocol
 *   leadDays     = days from discharge (when the follow-up is booked) to the follow-up
 *   missedBefore = an earlier follow-up was missed or is overdue (true / false)
 */
export function noShowInputs({ age, gender, protocol, leadDays, missedBefore = false }) {
  return {
    age,
    male: gender === 'male' ? 1 : 0,
    hypertension: protocol === 'cardiac' ? 1 : 0,
    diabetes: protocol === 'diabetes' ? 1 : 0,
    logLeadDays: Math.log1p(Math.max(leadDays, 0)),
    missedBefore: missedBefore ? 1 : 0,
  };
}

/** Probability (0 to 1) that the patient misses this follow-up. */
export function predictNoShow(patient) {
  const inputs = noShowInputs(patient);
  const z = model.features.reduce((sum, name) => sum + model.weights[name] * inputs[name], model.intercept);
  return 1 / (1 + Math.exp(-z));
}

// ---- Rules (decision B15) ------------------------------------------------------------------
// Things the public dataset doesn't have, so the model can't learn them yet. They are shown as
// reasons beside the score, never mixed into the %. Thresholds are demo values, to be replaced by
// learned weights once the model is retrained on our own follow-ups.
export const NO_SHOW_RULES = {
  lowAdherencePercent: 60, // same line as the rule-based risk band (D11)
  inactiveDays: 3, // no dose marked and no symptom report for this many days
  farKm: 100, // straight line from the district headquarters, about 2+ hours by road
};

/**
 * Plain-language reasons for the clinician, from the model's strongest input plus the rules.
 * @param {{ missedBefore: boolean, adherencePercent: number|null, daysInactive: number|null,
 *           distanceKm: number|null }} facts
 * @returns {string[]}
 */
// Already counted by the model (input missedBefore): shown to explain the %, not counted again.
export const MISSED_BEFORE_REASON = 'Missed an earlier follow-up';

export function noShowReasons({ missedBefore, adherencePercent, daysInactive, distanceKm }) {
  const reasons = [];
  if (missedBefore) reasons.push(MISSED_BEFORE_REASON);
  if (adherencePercent !== null && adherencePercent < NO_SHOW_RULES.lowAdherencePercent) {
    reasons.push(`Adherence ${adherencePercent}%`);
  }
  if (daysInactive !== null && daysInactive >= NO_SHOW_RULES.inactiveDays) {
    reasons.push(`No app activity for ${daysInactive} days`);
  }
  if (distanceKm !== null && distanceKm >= NO_SHOW_RULES.farKm) reasons.push(`Lives ~${distanceKm} km away`);
  return reasons;
}

const BANDS = ['low', 'moderate', 'high'];
const { p50, p75 } = model.metrics.scorePercentiles;
export const NO_SHOW_CUTOFFS = { moderate: p50, high: p75 };
export const RULE_REASONS_TO_BUMP = 2;

/**
 * Turns a probability into the badge the clinician sees (decision B16).
 *
 * 1. By score, using where scores fall on the training data (noshow-model.json,
 *    metrics.scorePercentiles), so the meaning survives a retrain:
 *      high     = riskiest quarter   (score >= 75th percentile, 0.329 now)
 *      moderate = above the median   (score >= 50th percentile, 0.283 now)
 *      low      = the rest
 * 2. Two or more RULE reasons (adherence, inactivity, distance) move it up one level:
 *    two separate barriers are worth a phone call even if the model's inputs look fine.
 *    "Missed an earlier follow-up" is already inside the score, so it is not counted twice.
 *
 * Same keys as the rule-based risk band, so the client reuses its colours.
 * @param {number} probability  0 to 1
 * @param {string[]} [reasons]  from noShowReasons()
 * @returns {'low'|'moderate'|'high'}
 */
export function noShowBand(probability, reasons = []) {
  let level = probability >= NO_SHOW_CUTOFFS.high ? 2 : probability >= NO_SHOW_CUTOFFS.moderate ? 1 : 0;
  const ruleReasons = reasons.filter((reason) => reason !== MISSED_BEFORE_REASON).length;
  if (ruleReasons >= RULE_REASONS_TO_BUMP) level = Math.min(level + 1, 2);
  return BANDS[level];
}
