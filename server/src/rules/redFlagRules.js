// Decision D9: the red-flag rule table. The rule engine checks every rule whose protocols
// include the patient's protocol ('*' = all), collects all matches, and the highest tier wins.
//
// These rules are for the college demo. They are loosely based on the sources cited, but they
// have NOT been clinically validated. A clinician must review them before any real use.
//
// Each rule: id (stored in triggeredRules), protocols, tier, description (shown to the
// clinician), when(log, plan) -> boolean, source.

const has = (log, code) => log.symptoms.includes(code);

const NICE_CHEST_PAIN = 'NICE CG95 Recent-onset chest pain of suspected cardiac origin (2010, updated 2016)';
const NICE_TLOC = "NICE CG109 Transient loss of consciousness ('blackouts') in over 16s (2010)";
const NICE_SEPSIS = 'NICE NG51 Suspected sepsis (2016, updated 2024): new confusion is a high-risk criterion';
const NICE_HF = 'NICE NG106 Chronic heart failure in adults (2018): worsening breathlessness or oedema';
const ADA = 'American Diabetes Association, Standards of Care in Diabetes 2025: hypoglycaemia and hyperglycaemic crises';
const KDIGO = 'KDIGO 2024 CKD guideline: reduced urine output and fluid overload need prompt review';
const NICE_SSI = 'NICE NG125 Surgical site infections (2019): wound infection signs after discharge';

export const RED_FLAG_RULES = [
  // ---- All protocols ----
  {
    id: 'GEN_CHEST_PAIN',
    protocols: ['*'],
    tier: 'emergency',
    description: 'Chest pain',
    when: (log) => has(log, 'CHEST_PAIN'),
    source: NICE_CHEST_PAIN,
  },
  {
    id: 'GEN_CONFUSION',
    protocols: ['*'],
    tier: 'emergency',
    description: 'New confusion',
    when: (log) => has(log, 'CONFUSION'),
    source: NICE_SEPSIS,
  },
  {
    id: 'GEN_BREATHLESS_SEVERE',
    protocols: ['*'],
    tier: 'emergency',
    description: 'Severe breathlessness (severity 4 or more)',
    when: (log) => has(log, 'BREATHLESS') && log.severity >= 4,
    source: NICE_HF,
  },
  {
    id: 'GEN_FAINTING',
    protocols: ['*'],
    tier: 'urgent',
    description: 'Fainting',
    when: (log) => has(log, 'FAINTING'),
    source: NICE_TLOC,
  },
  {
    id: 'GEN_PLAN_RED_FLAG',
    protocols: ['*'],
    tier: 'urgent',
    description: "A danger sign listed in this patient's discharge plan",
    when: (log, plan) => Boolean(plan) && log.symptoms.some((code) => plan.redFlags.includes(code)),
    source: 'Danger signs chosen by the treating clinician in the discharge plan',
  },
  {
    id: 'GEN_SEVERITY_5',
    protocols: ['*'],
    tier: 'urgent',
    description: 'Worst possible severity (5 of 5)',
    when: (log) => log.severity === 5,
    source: 'Patient-reported worst severity; review the same day',
  },
  {
    id: 'GEN_VOMITING_SEVERE',
    protocols: ['*'],
    tier: 'urgent',
    description: 'Severe vomiting (cannot keep medicines down)',
    when: (log) => has(log, 'VOMITING') && log.severity >= 4,
    source: 'Persistent vomiting stops the patient taking prescribed medicines; review the same day',
  },
  {
    id: 'GEN_FEVER',
    protocols: ['*'],
    tier: 'teleconsult',
    description: 'Fever (severity 3 or more)',
    when: (log) => has(log, 'FEVER') && log.severity >= 3,
    source: NICE_SEPSIS,
  },
  {
    id: 'GEN_BREATHLESS',
    protocols: ['*'],
    tier: 'teleconsult',
    description: 'Breathlessness',
    when: (log) => has(log, 'BREATHLESS'),
    source: NICE_HF,
  },

  // ---- Cardiac ----
  {
    id: 'CARD_BREATHLESS_SEV3',
    protocols: ['cardiac'],
    tier: 'urgent',
    description: 'Breathlessness (severity 3 or more) after a heart discharge',
    when: (log) => has(log, 'BREATHLESS') && log.severity >= 3,
    source: NICE_HF,
  },
  {
    id: 'CARD_FLUID_OVERLOAD',
    protocols: ['cardiac', 'ckd'],
    tier: 'urgent',
    description: 'Leg swelling with breathlessness (fluid overload)',
    when: (log) => has(log, 'SWELLING_LEGS') && has(log, 'BREATHLESS'),
    source: NICE_HF,
  },
  {
    id: 'CARD_SWELLING',
    protocols: ['cardiac'],
    tier: 'teleconsult',
    description: 'Leg swelling',
    when: (log) => has(log, 'SWELLING_LEGS'),
    source: NICE_HF,
  },
  {
    id: 'CARD_DIZZY',
    protocols: ['cardiac'],
    tier: 'teleconsult',
    description: 'Dizziness (severity 3 or more); low blood pressure from medicines?',
    when: (log) => has(log, 'DIZZY') && log.severity >= 3,
    source: NICE_HF,
  },

  // ---- Diabetes ----
  {
    id: 'DM_HYPO_SIGNS',
    protocols: ['diabetes'],
    tier: 'urgent',
    description: 'Shaky and sweaty: possible low blood sugar',
    when: (log) => has(log, 'SHAKY_SWEATY'),
    source: ADA,
  },
  {
    id: 'DM_HYPERGLYCAEMIC_CRISIS',
    protocols: ['diabetes'],
    tier: 'emergency',
    description: 'Extreme thirst with vomiting: possible hyperglycaemic crisis',
    when: (log) => has(log, 'EXTREME_THIRST') && has(log, 'VOMITING'),
    source: ADA,
  },
  {
    id: 'DM_THIRST',
    protocols: ['diabetes'],
    tier: 'teleconsult',
    description: 'Extreme thirst: possible high blood sugar',
    when: (log) => has(log, 'EXTREME_THIRST'),
    source: ADA,
  },
  {
    id: 'DM_WOUND',
    protocols: ['diabetes'],
    tier: 'teleconsult',
    description: 'Wound problem in a person with diabetes',
    when: (log) => has(log, 'WOUND_PROBLEM'),
    source: ADA,
  },

  // ---- CKD ----
  {
    id: 'CKD_LOW_URINE',
    protocols: ['ckd'],
    tier: 'urgent',
    description: 'Passing much less urine',
    when: (log) => has(log, 'LOW_URINE'),
    source: KDIGO,
  },
  {
    id: 'CKD_VOMITING',
    protocols: ['ckd'],
    tier: 'teleconsult',
    description: 'Vomiting with kidney disease',
    when: (log) => has(log, 'VOMITING'),
    source: KDIGO,
  },

  // ---- Post-surgical ----
  {
    id: 'SURG_WOUND_FEVER',
    protocols: ['post_surgical'],
    tier: 'urgent',
    description: 'Wound problem with fever: possible wound infection',
    when: (log) => has(log, 'WOUND_PROBLEM') && has(log, 'FEVER'),
    source: NICE_SSI,
  },
  {
    id: 'SURG_FEVER',
    protocols: ['post_surgical'],
    tier: 'urgent',
    description: 'Fever (severity 3 or more) after surgery',
    when: (log) => has(log, 'FEVER') && log.severity >= 3,
    source: NICE_SSI,
  },
  {
    id: 'SURG_WOUND',
    protocols: ['post_surgical'],
    tier: 'teleconsult',
    description: 'Wound redness, pain or discharge',
    when: (log) => has(log, 'WOUND_PROBLEM'),
    source: NICE_SSI,
  },
];

// Rule used by the missed-dose sweep (not a symptom rule).
export const MISSED_DOSE_RULE = {
  id: 'MISSED_CRITICAL_DOSE',
  tier: 'urgent', // Decision D6
  description: 'A critical medicine dose was not marked as taken within the grace window',
};

const RULE_DESCRIPTIONS = new Map(
  [...RED_FLAG_RULES, MISSED_DOSE_RULE].map((rule) => [rule.id, rule.description]),
);

/** Rule ID -> plain description for the clinician's screens. */
export function describeRule(id) {
  return RULE_DESCRIPTIONS.get(id) ?? id;
}
