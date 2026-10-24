// Decision D3: follow-up templates per protocol. On plan save, each entry becomes a FollowUp
// on dischargeDate + dayOffset.
//
// These are demonstration templates, loosely based on the guidelines cited. They are NOT a
// clinical protocol: a clinician must review them before any real use.

export const PROTOCOL_TEMPLATES = {
  cardiac: {
    source:
      'NICE NG106 Chronic heart failure in adults (2018): review within 2 weeks of discharge; ' +
      'ESC 2021 Heart Failure Guidelines: early follow-up visit 1-2 weeks after discharge.',
    followUps: [
      { dayOffset: 3, type: 'phone_check', description: 'Phone check: breathing, swelling, medicines' },
      { dayOffset: 7, type: 'in_person', description: 'Heart failure clinic review' },
      { dayOffset: 14, type: 'lab_test', description: 'Kidney function and electrolytes (on diuretics)' },
      { dayOffset: 30, type: 'in_person', description: '30-day review with the cardiologist' },
    ],
  },
  diabetes: {
    source:
      'American Diabetes Association, Standards of Care in Diabetes 2025: ' +
      'HbA1c about every 3 months when therapy has changed.',
    followUps: [
      { dayOffset: 7, type: 'phone_check', description: 'Phone check: sugar readings, low-sugar episodes' },
      { dayOffset: 14, type: 'in_person', description: 'Diabetes clinic review' },
      { dayOffset: 90, type: 'lab_test', description: 'HbA1c test' },
    ],
  },
  ckd: {
    source:
      'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD: ' +
      'monitor eGFR and albuminuria at a frequency set by risk.',
    followUps: [
      { dayOffset: 7, type: 'phone_check', description: 'Phone check: urine output, swelling' },
      { dayOffset: 14, type: 'lab_test', description: 'Serum creatinine and potassium' },
      { dayOffset: 30, type: 'in_person', description: 'Nephrology review' },
      { dayOffset: 90, type: 'lab_test', description: 'eGFR and urine albumin-creatinine ratio' },
    ],
  },
  post_surgical: {
    source:
      'NICE NG125 Surgical site infections: prevention and treatment (2019): ' +
      'wound review and advice on signs of infection after discharge.',
    followUps: [
      { dayOffset: 3, type: 'phone_check', description: 'Phone check: wound, fever, pain' },
      { dayOffset: 10, type: 'in_person', description: 'Wound review / stitch removal' },
      { dayOffset: 30, type: 'in_person', description: 'Post-operative review' },
    ],
  },
  general: {
    source:
      'NICE NG27 Transition between inpatient hospital settings and community or care home ' +
      'settings (2015): follow-up contact after discharge.',
    followUps: [
      { dayOffset: 7, type: 'phone_check', description: 'Phone check after discharge' },
      { dayOffset: 14, type: 'in_person', description: 'Clinic review' },
    ],
  },
};
