// Enumerations from the data dictionary (docs/08-phase1-data-dictionary.md).
export const ROLES = ['patient', 'clinician'];
export const LANGUAGES = ['en', 'hi', 'gu'];
export const GENDERS = ['male', 'female', 'other'];
export const PROTOCOLS = ['cardiac', 'diabetes', 'ckd', 'post_surgical', 'general'];
export const PLAN_STATUSES = ['active', 'completed', 'readmitted', 'lost_to_followup'];
export const MEDICATION_FORMS = ['tablet', 'capsule', 'syrup', 'injection'];
export const FREQUENCIES = { OD: 1, BD: 2, TDS: 3, QID: 4 }; // doses per day
export const TIMING_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
export const FOLLOW_UP_TYPES = ['in_person', 'teleconsult', 'lab_test', 'phone_check'];
export const FOLLOW_UP_STATUSES = ['scheduled', 'completed', 'missed'];
export const DOSE_STATUSES = ['pending', 'taken', 'missed'];
export const TIERS = ['self_care', 'teleconsult', 'urgent', 'emergency']; // lowest -> highest
export const ESCALATION_TIERS = TIERS.slice(1);
export const ESCALATION_SOURCES = ['symptom_log', 'missed_critical_dose'];
export const ESCALATION_STATUSES = ['open', 'acknowledged', 'resolved'];
