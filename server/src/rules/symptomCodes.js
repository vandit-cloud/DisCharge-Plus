// Decision D8: a fixed list of symptom codes. The patient taps icons; the clinician picks red
// flags from the same list. Codes (not free text) let the rule engine match them and let the
// client translate them into Gujarati and Hindi.
export const SYMPTOM_CODES = [
  'CHEST_PAIN',
  'BREATHLESS',
  'SWELLING_LEGS',
  'DIZZY',
  'FAINTING',
  'CONFUSION',
  'FEVER',
  'VOMITING',
  'SHAKY_SWEATY',
  'EXTREME_THIRST',
  'LOW_URINE',
  'WOUND_PROBLEM',
];

// Red flags the Discharge Plan Editor pre-ticks for each protocol (the clinician can change them).
export const DEFAULT_RED_FLAGS = {
  cardiac: ['CHEST_PAIN', 'BREATHLESS', 'SWELLING_LEGS', 'FAINTING'],
  diabetes: ['SHAKY_SWEATY', 'CONFUSION', 'EXTREME_THIRST', 'WOUND_PROBLEM'],
  ckd: ['LOW_URINE', 'SWELLING_LEGS', 'BREATHLESS', 'CONFUSION'],
  post_surgical: ['FEVER', 'WOUND_PROBLEM', 'CHEST_PAIN', 'BREATHLESS'],
  general: ['CHEST_PAIN', 'BREATHLESS', 'CONFUSION', 'FAINTING'],
};
