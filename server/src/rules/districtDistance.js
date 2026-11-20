// Distance rule for the no-show reasons (decision B15): how far the patient's district is from
// the hospital, using the district they already chose at sign-up (no new field).
//
// Distance = straight line ("as the crow flies") between district HEADQUARTERS, so it is coarse:
// a village can be far from its own headquarters, and roads are longer than straight lines.
// Coordinates are approximate (to about 5 km), which is enough to sort districts into near / far.

// The hospital the demo is set in (Vadodara). Change this if the app is used elsewhere.
export const HOSPITAL_DISTRICT = 'Vadodara';

// District -> [latitude, longitude] of its headquarters town (in brackets when the name differs).
export const DISTRICT_HQ = {
  Ahmedabad: [23.02, 72.57],
  Amreli: [21.6, 71.22],
  Anand: [22.56, 72.95],
  Aravalli: [23.46, 73.3], // Modasa
  Banaskantha: [24.17, 72.43], // Palanpur
  Bharuch: [21.7, 72.98],
  Bhavnagar: [21.76, 72.15],
  Botad: [22.17, 71.67],
  'Chhota Udepur': [22.31, 74.01],
  Dahod: [22.84, 74.25],
  Dang: [20.76, 73.69], // Ahwa
  'Devbhumi Dwarka': [22.2, 69.65], // Khambhalia
  Gandhinagar: [23.22, 72.65],
  'Gir Somnath': [20.91, 70.37], // Veraval
  Jamnagar: [22.47, 70.06],
  Junagadh: [21.52, 70.46],
  Kheda: [22.69, 72.86], // Nadiad
  Kutch: [23.24, 69.67], // Bhuj
  Mahisagar: [23.13, 73.61], // Lunawada
  Mehsana: [23.6, 72.38],
  Morbi: [22.82, 70.84],
  Narmada: [21.87, 73.5], // Rajpipla
  Navsari: [20.95, 72.92],
  Panchmahal: [22.78, 73.61], // Godhra
  Patan: [23.85, 72.13],
  Porbandar: [21.64, 69.61],
  Rajkot: [22.3, 70.8],
  Sabarkantha: [23.6, 72.97], // Himmatnagar
  Surat: [21.17, 72.83],
  Surendranagar: [22.73, 71.64],
  Tapi: [21.11, 73.39], // Vyara
  Vadodara: [22.31, 73.18],
  Valsad: [20.61, 72.93],
};

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle (haversine) distance in km between two [lat, lon] points. */
export function haversineKm([lat1, lon1], [lat2, lon2]) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Whole km from the district's headquarters to the hospital, or null for an unknown district. */
export function distanceToHospitalKm(district) {
  const from = DISTRICT_HQ[district];
  return from ? Math.round(haversineKm(from, DISTRICT_HQ[HOSPITAL_DISTRICT])) : null;
}
