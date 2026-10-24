// Demo data (FR-9). SYNTHETIC ONLY: every name, number and record here is invented.
//
//   npm run seed
//
// Wipes the database named in MONGODB_URI and rebuilds it. As a safety check it only runs when
// the database name contains "discharge". Data is created through the real services at
// simulated past times, so it follows the same rules as live use.
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { sweepMissedDoses } from '../src/jobs/missedDoseSweep.js';
import {
  AdherenceRecord, DischargePlan, Escalation, FollowUp, Medication, Patient, Prescription, User,
} from '../src/models/index.js';
import { DEFAULT_RED_FLAGS } from '../src/rules/symptomCodes.js';
import { hashPassword } from '../src/services/authService.js';
import { acknowledgeEscalation, resolveEscalation } from '../src/services/escalationService.js';
import { changePlanStatus, createPlan } from '../src/services/planService.js';
import { reportSymptoms } from '../src/services/symptomService.js';
import { addDays, addMinutes, atIstTime, istToday } from '../src/utils/time.js';

const PASSWORD = 'demo1234';
const HOUR = 60;

// Deterministic random numbers, so every run produces the same story.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2026);
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];

const MEDICATIONS = [
  ['furosemide', 'tablet', '40 mg'], ['spironolactone', 'tablet', '25 mg'], ['carvedilol', 'tablet', '6.25 mg'],
  ['metoprolol', 'tablet', '25 mg'], ['atorvastatin', 'tablet', '20 mg'], ['aspirin', 'tablet', '75 mg'],
  ['clopidogrel', 'tablet', '75 mg'], ['ramipril', 'capsule', '5 mg'], ['amlodipine', 'tablet', '5 mg'],
  ['metformin', 'tablet', '500 mg'], ['glimepiride', 'tablet', '1 mg'], ['insulin glargine', 'injection', '100 IU/ml'],
  ['sodium bicarbonate', 'tablet', '500 mg'], ['calcium carbonate', 'tablet', '500 mg'],
  ['amoxicillin-clavulanate', 'tablet', '625 mg'], ['cefuroxime', 'tablet', '500 mg'], ['paracetamol', 'tablet', '500 mg'],
  ['pantoprazole', 'tablet', '40 mg'], ['ondansetron', 'tablet', '4 mg'], ['levothyroxine', 'tablet', '50 mcg'],
];

// [medicine, dosage, frequency, slots, days, critical]
const OD_M = ['OD', ['morning']];
const OD_N = ['OD', ['night']];
const BD = ['BD', ['morning', 'night']];
const TDS = ['TDS', ['morning', 'afternoon', 'night']];
const REGIMENS = {
  heartFailure: [['furosemide', '1 tablet', ...OD_M, 30, true], ['carvedilol', '1 tablet', ...BD, 30, false], ['atorvastatin', '1 tablet', ...OD_N, 30, false]],
  postMI: [['aspirin', '1 tablet', ...OD_M, 30, true], ['clopidogrel', '1 tablet', ...OD_M, 30, true], ['metoprolol', '1 tablet', ...BD, 30, false], ['atorvastatin', '1 tablet', ...OD_N, 30, false]],
  diabetes: [['metformin', '1 tablet', ...BD, 30, false], ['glimepiride', '1 tablet', ...OD_M, 30, false], ['insulin glargine', '10 units', ...OD_N, 30, true]],
  ckd: [['furosemide', '1 tablet', ...OD_M, 30, true], ['amlodipine', '1 tablet', ...OD_M, 30, false], ['sodium bicarbonate', '1 tablet', ...BD, 30, false]],
  surgery: [['amoxicillin-clavulanate', '1 tablet', ...TDS, 7, true], ['paracetamol', '1 tablet', ...TDS, 5, false], ['pantoprazole', '1 tablet', ...OD_M, 14, false]],
  general: [['cefuroxime', '1 tablet', ...BD, 7, true], ['paracetamol', '1 tablet', ...TDS, 5, false], ['pantoprazole', '1 tablet', ...OD_M, 14, false]],
};

const CLINICIANS = [
  { fullName: 'Dr. Ananya Mehta', phone: '9000000001', preferredLanguage: 'en' },
  { fullName: 'Dr. Rohan Shah', phone: '9000000002', preferredLanguage: 'en' },
];

// daysAgo = days since discharge; adherence = chance of taking each dose.
const PATIENTS = [
  { fullName: 'Kantaben Rathwa', gender: 'female', dob: '1965-03-14', district: 'Chhota Udepur', lang: 'gu', protocol: 'cardiac', diagnosis: 'Heart failure (HFrEF) with type 2 diabetes', regimen: 'kantaben', daysAgo: 6, adherence: 1, abhaId: '00001234567890', script: 'kantaben' },
  { fullName: 'Bhavna Rathwa', gender: 'female', dob: '1958-07-02', district: 'Chhota Udepur', lang: 'gu', protocol: 'cardiac', diagnosis: 'Acute myocardial infarction, after PCI', regimen: 'postMI', daysAgo: 4, adherence: 0.95, script: 'chestPainToday' },
  { fullName: 'Ramesh Vasava', gender: 'male', dob: '1962-11-20', district: 'Narmada', lang: 'gu', protocol: 'diabetes', diagnosis: 'Type 2 diabetes with foot ulcer', regimen: 'diabetes', daysAgo: 11, adherence: 0.55 },
  { fullName: 'Jashoda Bhil', gender: 'female', dob: '1970-01-09', district: 'Dahod', lang: 'hi', protocol: 'ckd', diagnosis: 'Chronic kidney disease stage 4', regimen: 'ckd', daysAgo: 18, adherence: 0.8 },
  { fullName: 'Mahesh Tadvi', gender: 'male', dob: '1955-05-30', district: 'Narmada', lang: 'gu', protocol: 'cardiac', diagnosis: 'Heart failure, NYHA class III', regimen: 'heartFailure', daysAgo: 9, adherence: 0.7 },
  { fullName: 'Savita Damor', gender: 'female', dob: '1981-09-17', district: 'Dahod', lang: 'hi', protocol: 'post_surgical', diagnosis: 'Laparoscopic cholecystectomy', regimen: 'surgery', daysAgo: 3, adherence: 0.9 },
  { fullName: 'Govind Baria', gender: 'male', dob: '1949-12-01', district: 'Panchmahal', lang: 'gu', protocol: 'cardiac', diagnosis: 'Unstable angina', regimen: 'postMI', daysAgo: 22, adherence: 0.92 },
  { fullName: 'Lakshmi Parmar', gender: 'female', dob: '1968-04-25', district: 'Vadodara', lang: 'gu', protocol: 'diabetes', diagnosis: 'Diabetic ketoacidosis, recovered', regimen: 'diabetes', daysAgo: 5, adherence: 0.85 },
  { fullName: 'Nanji Chaudhari', gender: 'male', dob: '1960-08-08', district: 'Tapi', lang: 'gu', protocol: 'ckd', diagnosis: 'CKD stage 3b with hypertension', regimen: 'ckd', daysAgo: 27, adherence: 0.95 },
  { fullName: 'Hansa Solanki', gender: 'female', dob: '1975-02-14', district: 'Vadodara', lang: 'en', protocol: 'general', diagnosis: 'Community-acquired pneumonia', regimen: 'general', daysAgo: 8, adherence: 0.9 },
  { fullName: 'Dinesh Nayak', gender: 'male', dob: '1983-06-21', district: 'Panchmahal', lang: 'hi', protocol: 'post_surgical', diagnosis: 'Appendicectomy', regimen: 'surgery', daysAgo: 13, adherence: 0.75 },
  { fullName: 'Kamla Dhodia', gender: 'female', dob: '1952-10-03', district: 'Valsad', lang: 'gu', protocol: 'cardiac', diagnosis: 'Heart failure with atrial fibrillation', regimen: 'heartFailure', daysAgo: 2, adherence: 0.88 },
  { fullName: 'Arjun Gamit', gender: 'male', dob: '1978-03-11', district: 'Tapi', lang: 'gu', protocol: 'diabetes', diagnosis: 'Type 2 diabetes, newly on insulin', regimen: 'diabetes', daysAgo: 16, adherence: 0.97 },
  { fullName: 'Manjula Koli', gender: 'female', dob: '1966-12-29', district: 'Valsad', lang: 'gu', protocol: 'general', diagnosis: 'Urinary tract infection with sepsis, treated', regimen: 'general', daysAgo: 20, adherence: 0.93 },
  { fullName: 'Prakash Bariya', gender: 'male', dob: '1959-07-19', district: 'Panchmahal', lang: 'gu', protocol: 'ckd', diagnosis: 'Acute kidney injury on CKD', regimen: 'ckd', daysAgo: 7, adherence: 0.6, clinician: 1 },
  { fullName: 'Rekha Rathod', gender: 'female', dob: '1972-05-05', district: 'Vadodara', lang: 'hi', protocol: 'diabetes', diagnosis: 'Type 2 diabetes with hypoglycaemia episode', regimen: 'diabetes', daysAgo: 10, adherence: 0.9, clinician: 1 },
  { fullName: 'Suresh Patel', gender: 'male', dob: '1964-09-12', district: 'Vadodara', lang: 'en', protocol: 'cardiac', diagnosis: 'Heart failure after myocardial infarction', regimen: 'heartFailure', daysAgo: 25, adherence: 0.96, clinician: 1 },
  { fullName: 'Geeta Makwana', gender: 'female', dob: '1980-11-30', district: 'Dang', lang: 'gu', protocol: 'post_surgical', diagnosis: 'Caesarean section', regimen: 'surgery', daysAgo: 6, adherence: 0.9, clinician: 1 },
  { fullName: 'Bharat Thakor', gender: 'male', dob: '1951-01-22', district: 'Chhota Udepur', lang: 'gu', protocol: 'cardiac', diagnosis: 'Heart failure', regimen: 'heartFailure', daysAgo: 48, adherence: 0.9, closedAs: 'completed' },
  { fullName: 'Parvati Nayka', gender: 'female', dob: '1969-06-16', district: 'Dahod', lang: 'hi', protocol: 'diabetes', diagnosis: 'Type 2 diabetes', regimen: 'diabetes', daysAgo: 55, adherence: 0.7, closedAs: 'lost_to_followup' },
];
REGIMENS.kantaben = [
  ['furosemide', '1 tablet', ...OD_M, 30, true],
  ['metformin', '1 tablet', ...BD, 30, false],
  ['carvedilol', '1 tablet', ...BD, 30, false],
  ['atorvastatin', '1 tablet', ...OD_N, 30, false],
];

const SYMPTOM_SCENARIOS = {
  cardiac: [[['DIZZY'], 2], [['SWELLING_LEGS'], 2], [['DIZZY'], 3], [['BREATHLESS'], 2], [['FEVER'], 1]],
  diabetes: [[['EXTREME_THIRST'], 2], [['SHAKY_SWEATY'], 3], [['DIZZY'], 1], [['WOUND_PROBLEM'], 2], [['FEVER'], 2]],
  ckd: [[['SWELLING_LEGS'], 2], [['VOMITING'], 2], [['LOW_URINE'], 3], [['DIZZY'], 1]],
  post_surgical: [[['WOUND_PROBLEM'], 2], [['FEVER'], 2], [['VOMITING'], 1], [['WOUND_PROBLEM', 'FEVER'], 3]],
  general: [[['FEVER'], 2], [['DIZZY'], 1], [['VOMITING'], 2], [['BREATHLESS'], 2]],
};
const RESOLUTION_NOTES = [
  'Called the patient. Symptoms settled; advised to continue medicines and report again if worse.',
  'Spoke to patient and family. Dose taken late; reminded about timing. No further action.',
  'Asked the patient to visit the PHC for a check. Seen there, vitals stable.',
  'Teleconsult done. Dose adjusted; review at the next follow-up.',
  'Patient seen in OPD the same day. Managed, sent home with advice.',
];

async function main() {
  await connectDB(env.mongodbUri);
  const dbName = mongoose.connection.name;
  if (!/discharge/i.test(dbName) && !process.argv.includes('--force')) {
    throw new Error(`Refusing to wipe database "${dbName}". Use a database whose name contains "discharge".`);
  }
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));

  const NOW = new Date();
  const today = istToday(NOW);
  const passwordHash = await hashPassword(PASSWORD);
  const meds = new Map(
    (await Medication.create(MEDICATIONS.map(([genericName, form, strength]) => ({ genericName, form, strength })))).map((m) => [m.genericName, m]),
  );
  const clinicians = await User.create(CLINICIANS.map((c) => ({ ...c, phone: `+91${c.phone}`, passwordHash, role: 'clinician' })));

  const symptomJobs = []; // run in time order after all plans exist
  const patientPlans = [];
  for (const [index, p] of PATIENTS.entries()) {
    const phone = `+91${9000000101 + index}`;
    const user = await User.create({ fullName: p.fullName, phone, passwordHash, role: 'patient', preferredLanguage: p.lang });
    const patient = await Patient.create({ userId: user._id, abhaId: p.abhaId, dateOfBirth: new Date(`${p.dob}T00:00:00Z`), gender: p.gender, district: p.district });
    const clinician = clinicians[p.clinician ?? 0];
    const dischargeDate = addDays(today, -p.daysAgo);

    const { plan } = await createPlan(
      clinician._id,
      {
        patientId: patient._id,
        admissionDate: addDays(dischargeDate, -between(3, 8)),
        dischargeDate,
        primaryDiagnosis: p.diagnosis,
        redFlags: DEFAULT_RED_FLAGS[p.protocol],
        followUpProtocol: p.protocol,
        prescriptions: REGIMENS[p.regimen].map(([name, dosage, frequency, timingSlots, durationDays, isCritical]) => ({
          medicationId: meds.get(name)._id, dosage, frequency, timingSlots, durationDays, isCritical,
        })),
      },
      atIstTime(dischargeDate, '07:00'),
    );

    // Doses: the patient takes each one with probability `adherence` (critical ones a bit more often).
    const closeAt = p.closedAs ? atIstTime(addDays(dischargeDate, 30), '12:00') : null;
    const until = closeAt ?? NOW;
    const prescriptions = await Prescription.find({ planId: plan.planId });
    const criticalIds = new Set(prescriptions.filter((x) => x.isCritical).map((x) => String(x._id)));
    const doses = await AdherenceRecord.find({ prescriptionId: { $in: prescriptions.map((x) => x._id) }, scheduledAt: { $lte: until } });
    const updates = [];
    for (const dose of doses) {
      const recordedAt = addMinutes(dose.scheduledAt, between(0, 50));
      if (recordedAt > until) continue;
      const critical = criticalIds.has(String(dose.prescriptionId));
      let taken = random() < (critical ? Math.min(0.98, p.adherence + 0.1) : p.adherence);
      if (p.script === 'kantaben') {
        const day = Math.floor((dose.scheduledAt - atIstTime(dischargeDate, '08:00')) / 86_400_000);
        const hourIst = (dose.scheduledAt.getUTCHours() + 5.5) % 24;
        taken = !(day === 3 && hourIst < 12) && !(day === 4 && hourIst > 20 && !critical);
      }
      if (taken) updates.push({ updateOne: { filter: { _id: dose._id }, update: { $set: { status: 'taken', recordedAt } } } });
    }
    if (updates.length) await AdherenceRecord.bulkWrite(updates);
    if (closeAt) await changePlanStatus(clinician._id, plan.planId, p.closedAs, closeAt);

    // Past follow-ups: most are done on the day, a few are left overdue.
    for (const followUp of await FollowUp.find({ planId: plan.planId, scheduledDate: { $lt: closeAt ? addDays(dischargeDate, 31) : today } })) {
      if (p.closedAs || p.script === 'kantaben' || random() < 0.75) {
        followUp.status = 'completed';
        followUp.completedDate = followUp.scheduledDate;
        await followUp.save();
      }
    }

    patientPlans.push({ p, patient, clinician, dischargeDate });
    if (p.closedAs) continue;
    if (p.script === 'kantaben') {
      symptomJobs.push({ patientId: patient._id, symptoms: ['BREATHLESS'], severity: 3, at: addMinutes(NOW, -95) });
    } else if (p.script === 'chestPainToday') {
      symptomJobs.push({ patientId: patient._id, symptoms: ['CHEST_PAIN', 'BREATHLESS'], severity: 4, at: addMinutes(NOW, -40) });
    }
    const reports = p.script ? 0 : between(0, 3);
    for (let i = 0; i < reports; i += 1) {
      const [symptoms, severity] = pick(SYMPTOM_SCENARIOS[p.protocol]);
      const at = addMinutes(atIstTime(addDays(dischargeDate, 1), '09:00'), between(0, Math.max(1, (p.daysAgo - 1) * 24 * HOUR)));
      if (at < addMinutes(NOW, -30)) symptomJobs.push({ patientId: patient._id, symptoms, severity, at });
    }
  }

  // Symptom reports in time order; the escalation is dated when the report was made.
  symptomJobs.sort((a, b) => a.at - b.at);
  for (const job of symptomJobs) {
    const { escalation } = await reportSymptoms(job.patientId, job, job.at);
    if (escalation) await Escalation.collection.updateOne({ _id: new mongoose.Types.ObjectId(escalation.escalationId) }, { $set: { createdAt: job.at } });
  }

  // Missed doses (and critical-dose escalations), dated shortly after each grace window closed.
  const sweep = await sweepMissedDoses(NOW);
  for (const escalation of await Escalation.find({ source: 'missed_critical_dose' })) {
    const dose = await AdherenceRecord.findById(escalation.adherenceId);
    const createdAt = addMinutes(dose.scheduledAt, env.doseGraceMinutes + between(1, 15));
    await Escalation.collection.updateOne({ _id: escalation._id }, { $set: { createdAt } });
  }

  // Clinicians have handled the older escalations: > 48 h resolved, 6-48 h sometimes acknowledged.
  const kantaben = patientPlans.find((x) => x.p.script === 'kantaben');
  for (const escalation of await Escalation.find().sort({ createdAt: 1 })) {
    const clinicianId = escalation.assignedClinicianId;
    const ageHours = (NOW - escalation.createdAt) / 3_600_000;
    const ackAt = addMinutes(escalation.createdAt, between(20, 180));
    const isKantaben = String(escalation.patientId) === String(kantaben.patient._id);
    if (isKantaben && escalation.source === 'missed_critical_dose') {
      await acknowledgeEscalation(clinicianId, escalation._id, ackAt); // Day 3: called, still being watched
    } else if (ageHours > 48) {
      await acknowledgeEscalation(clinicianId, escalation._id, ackAt);
      await resolveEscalation(clinicianId, escalation._id, pick(RESOLUTION_NOTES), addMinutes(ackAt, between(60, 360)));
    } else if (ageHours > 6 && random() < 0.5 && ackAt < NOW) {
      await acknowledgeEscalation(clinicianId, escalation._id, ackAt);
    }
  }

  const count = async (model, filter = {}) => model.countDocuments(filter);
  console.log(`Seeded database "${dbName}" (synthetic data):`);
  console.log(`  ${await count(User)} users, ${await count(DischargePlan)} plans, ${await count(AdherenceRecord)} doses, ${await count(FollowUp)} follow-ups`);
  console.log(`  ${symptomJobs.length} symptom reports, ${await count(Escalation)} escalations (${await count(Escalation, { status: { $ne: 'resolved' } })} open or acknowledged)`);
  console.log(`  sweep: ${JSON.stringify(sweep)}`);
  console.log('\nDemo logins (password for all: demo1234)');
  console.log('  Clinician  Dr. Ananya Mehta   9000000001');
  console.log('  Clinician  Dr. Rohan Shah     9000000002');
  console.log('  Patient    Kantaben Rathwa    9000000101  (the 30-day demo journey, Gujarati)');
  console.log('  Patient    Bhavna Rathwa      9000000102  (chest pain today -> emergency)');
  console.log(`  Patients   others             9000000103 - 90000001${String(PATIENTS.length).padStart(2, '0')}`);
}

try {
  await main();
} finally {
  await mongoose.disconnect();
}
