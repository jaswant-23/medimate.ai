const text = `Shree Sai Clinic	
Dr. Anil Kulkarni	
Shree Sai	
- CLINIC -	MBBS, DNB (Internal Medicine) | Reg: MMC/2018/32456	
Shop No. 4, Sai Complex	
Jalna Road, Opp. MGM Hospital	
Aurangabad, Maharashtra - 431003	
C 9890123456 [@j dr.anil.kulkarni@sai-clinic.com	
Patient: Rahul Deshmukh	Date: 2026-03-08	
Age: 45 | Male | G 9012345678	Follow Up: 2026-03-14	
Complaints: Sore throat, mild fever	
Diagnosis: Throat Infection	
Bx	
Medicine	Dosage	Duration	Instructions	
Azithromycin 500mg	1-0-0	3 Days	After meal	
Notes: Avoid cold drinks.	
Consultation Fee: 7300 V Paid	Dr. Anil Kulkarni`;

const DOSAGE_UNITS_RE = /(?:\b\d+(?:\.\d+)?\s*(?:g|mg|ml|mcg|iu|units?)\b)|\b(tablet[s]?|capsule[s]?|cap[s]?|tab[s]?|syrup|drop[s]?|spray|cream|ointment|injection|inhaler|lotion|gel|patch)\b/i;
const DOSAGE_SCHEDULE_RE = /\b(\d[-–]\d[-–]\d|\d+\s*[-–]\s*\d+\s*[-–]\s*\d+|OD|BD|TDS|QID|SOS|PRN|HS|AC|PC|STAT)\b/i;

const MEDICINE_BLOCKLIST = new Set([
  'clinic', 'hospital', 'centre', 'center', 'medical', 'health', 'care', 'pharmacy',
  'dispensary', 'nursing', 'home', 'super', 'speciality', 'specialty',
  'doctor', 'dr', 'patient', 'name', 'date', 'age', 'gender', 'male', 'female',
  'address', 'contact', 'phone', 'mobile', 'email', 'reg', 'registration',
  'diagnosis', 'complaint', 'complaints', 'symptom', 'symptoms', 'history',
  'examination', 'investigation', 'test', 'tests', 'allergy', 'allergies',
  'prescription', 'rx', 'advice', 'notes', 'note', 'instruction', 'instructions',
  'follow', 'followup', 'review', 'checkup',
  'daily', 'weekly', 'monthly', 'morning', 'evening', 'night', 'noon', 'afternoon',
  'before', 'after', 'meal', 'meals', 'food', 'empty', 'stomach', 'water',
  'duration', 'days', 'day', 'weeks', 'week', 'months', 'month', 'times', 'time',
  'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'drops', 'injection',
  'spray', 'cream', 'ointment', 'inhaler', 'gel', 'lotion', 'patch',
  'dose', 'dosage', 'quantity', 'refill', 'take', 'apply', 'use',
  'signature', 'seal', 'stamp', 'fee', 'paid', 'total', 'amount', 'rupees', 'rs',
  'shop', 'sector', 'road', 'street', 'lane', 'nagar', 'complex', 'building',
  'floor', 'near', 'opposite', 'behind', 'above', 'below',
  'mr', 'mrs', 'ms', 'miss', 'sir', 'madam', 'md', 'mbbs', 'ms', 'bds', 'dnb',
  'mumbai', 'delhi', 'pune', 'bangalore', 'chennai', 'hyderabad', 'kolkata',
  'aurangabad', 'nagpur', 'noida', 'maharashtra', 'india',
  'internal', 'medicine', 'general', 'surgery', 'ortho', 'paediatric', 'gynaec',
  'derma', 'cardio', 'neuro', 'ophthal', 'ent', 'department', 'dept',
]);

const RX_START_MARKERS = [
  /\bRx\b/i, /\bR\/\b/i, /\bPx\b/i, /\bBx\b/i, /\bMedicine[s]?\s*:/i,
  /\bDrug[s]?\s*:/i, /\bPrescription\s*:/i, /\bMedicine\s+Dosage\b/i,
  /\bDrug\s+Name\b/i, /\bTab\./i, /\bCap\./i, /\bSyrup\b/i,
];

const RX_END_MARKERS = [
  /\bFollow[\s-]*Up\b/i, /\bAdvice\b/i, /\bNotes?\b/i,
  /\bConsultation\s*Fee\b/i, /\bSignature\b/i,
  /\bDiagnosis\b/i, /\bComplaint[s]?\b/i, /\bSymptons?\b/i, /\bTests?\b/i, /\bInvestigation[s]?\b/i,
];

function toTitleCase(str) {
  return str.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function cleanMedicineName(raw) {
  let name = raw.trim();
  name = name.replace(/\(.*?\)/g, '').trim();
  name = name.replace(DOSAGE_SCHEDULE_RE, '').trim();
  name = name.replace(/\s*(?:-?\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu|units?)\b).*/i, '').trim();
  name = name.replace(/\s+\d+\s*(days?|weeks?|months?)\b.*/i, '').trim();
  name = name.replace(/\s+(tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler|gel|lotion|patch)s?\b.*/i, '').trim();
  name = name.replace(/\b(duration|dose|dosage|frequency|qty|quantity|take|route|times|once|twice|thrice)\b.*/i, '').trim();
  name = name.replace(/[.,;:\-–—\/\\]+$/, '').trim();
  return name;
}

function isBlocklisted(word) {
  return MEDICINE_BLOCKLIST.has(word.toLowerCase().trim());
}

function isValidMedicineName(name) {
  const trimmed = name.trim();
  if (trimmed.length < 4) return false;
  if (/^[\d\s.,;:\-–—\/\\|]+$/.test(trimmed)) return false;
  const words = trimmed.replace(/[.,;:\-–—\/\\|()]/g, ' ').split(/\s+/).filter(Boolean);
  const nonBlockWords = words.filter(w => !isBlocklisted(w));
  const filteredName = nonBlockWords.join(' ');
  if (!/[a-zA-Z]{3}/.test(filteredName)) return false;
  if (/^\d+[-–]\d+[-–]\d+$/.test(trimmed)) return false;
  return true;
}

const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
let startIdx = -1, endIdx = allLines.length;
for (let i = 0; i < allLines.length; i++) {
  const line = allLines[i];
  if (startIdx === -1 && RX_START_MARKERS.some((re) => re.test(line))) {
    startIdx = i + 1; continue;
  }
  if (startIdx !== -1 && RX_END_MARKERS.some((re) => re.test(line))) {
    endIdx = i; break;
  }
}
if (startIdx === -1) startIdx = 0;

console.log("Start:", startIdx, "End:", endIdx);
console.log("Section:");
console.log(allLines.slice(startIdx, endIdx));

let rawNames = [];
let namesFromSection = [];
for (const line of allLines.slice(startIdx, endIdx)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) continue;
  let candidate = null;
  const numMatch = trimmed.match(/^[\d]+[.)]\s+(.+)/);
  if (numMatch?.[1]) candidate = numMatch[1];
  if (!candidate) {
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (bulletMatch?.[1]) candidate = bulletMatch[1];
  }
  if (!candidate) {
    const tcMatch = trimmed.match(/^(?:Tab\.?|Cap\.?|Syrup\.?|Inj\.?)\s+(.+)/i);
    if (tcMatch?.[1]) candidate = tcMatch[1];
  }
  if (!candidate && DOSAGE_UNITS_RE.test(trimmed)) {
    candidate = trimmed;
  }
  if (candidate) {
    const cleaned = cleanMedicineName(candidate);
    if (isValidMedicineName(cleaned)) {
      namesFromSection.push(cleaned);
    }
  }
}
console.log("Names from section:", namesFromSection);

if (namesFromSection.length === 0) {
  console.log("Section extraction failed, falling back...");
  for (const line of allLines) {
    const trimmed = line.trim();
    if (!DOSAGE_UNITS_RE.test(trimmed)) continue;
    const cleaned = cleanMedicineName(trimmed);
    if (isValidMedicineName(cleaned)) {
      rawNames.push(cleaned);
    }
  }
} else {
  rawNames = namesFromSection;
}

console.log("Extracted:");
console.log(rawNames);
