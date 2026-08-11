import { Request, Response } from 'express';

// ── Extended blocklist for server-side validation ────────────────
const MEDICINE_BLOCKLIST = new Set([
  // Clinic / Hospital metadata
  'clinic', 'hospital', 'centre', 'center', 'medical', 'health', 'care', 'pharmacy',
  'dispensary', 'nursing', 'home', 'super', 'speciality', 'specialty',
  // Doctor / Patient labels
  'doctor', 'dr', 'patient', 'name', 'date', 'age', 'gender', 'male', 'female',
  'address', 'contact', 'phone', 'mobile', 'email', 'reg', 'registration',
  // Prescription structure words
  'diagnosis', 'complaint', 'complaints', 'symptom', 'symptoms', 'history',
  'examination', 'investigation', 'test', 'tests', 'allergy', 'allergies',
  'prescription', 'rx', 'advice', 'notes', 'note', 'instruction', 'instructions',
  'follow', 'followup', 'review', 'checkup',
  // Dosage / duration words
  'daily', 'weekly', 'monthly', 'morning', 'evening', 'night', 'noon', 'afternoon',
  'before', 'after', 'meal', 'meals', 'food', 'empty', 'stomach', 'water',
  'duration', 'days', 'day', 'weeks', 'week', 'months', 'month', 'times', 'time',
  'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'drops', 'injection',
  'spray', 'cream', 'ointment', 'inhaler', 'gel', 'lotion', 'patch',
  'dose', 'dosage', 'quantity', 'refill', 'take', 'apply', 'use',
  // Common irrelevant words
  'signature', 'seal', 'stamp', 'fee', 'paid', 'total', 'amount', 'rupees', 'rs',
  'shop', 'sector', 'road', 'street', 'lane', 'nagar', 'complex', 'building',
  'floor', 'near', 'opposite', 'behind', 'above', 'below',
  // Titles
  'mr', 'mrs', 'ms', 'miss', 'sir', 'madam', 'md', 'mbbs', 'ms', 'bds', 'dnb',
  // Common Indian location words
  'mumbai', 'delhi', 'pune', 'bangalore', 'chennai', 'hyderabad', 'kolkata',
  'aurangabad', 'nagpur', 'noida', 'maharashtra', 'india',
  // Generic section labels
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

const DOSAGE_UNITS_RE = /(?:\b\d+(?:\.\d+)?\s*(?:g|mg|ml|mcg|iu|units?)\b)|\b(tablet[s]?|capsule[s]?|cap[s]?|tab[s]?|syrup|drop[s]?|spray|cream|ointment|injection|inhaler|lotion|gel|patch)\b/i;
const DOSAGE_SCHEDULE_RE = /\b(\d[-–]\d[-–]\d|\d+\s*[-–]\s*\d+\s*[-–]\s*\d+|OD|BD|TDS|QID|SOS|PRN|HS|AC|PC|STAT)\b/i;

function toTitleCase(str: string): string {
  return str.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function cleanMedicineName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/\(.*?\)/g, '').trim();
  name = name.replace(DOSAGE_SCHEDULE_RE, '').trim();
  name = name.replace(/\s*(?:-?\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu|units?)\b).*/i, '').trim();
  name = name.replace(/\s+\d+\s*(days?|weeks?|months?)\b.*/i, '').trim();
  name = name.replace(/\s+(tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler|gel|lotion|patch)s?\b.*/i, '').trim();
  name = name.replace(/\b(duration|dose|dosage|frequency|qty|quantity|take|route|times|once|twice|thrice)\b.*/i, '').trim();
  name = name.replace(/[.,;:–—/\\-]+$/, '').trim();
  return name;
}

function isValidMedicine(name: string): boolean {
  const t = name.trim();
  if (t.length < 4) return false;
  if (/^[\d\s.,;:–—/\\|-]+$/.test(t)) return false;
  
  const words = t.replace(/[.,;:–—/\\|()-]/g, ' ').split(/\s+/).filter(Boolean);
  const nonBlockWords = words.filter(w => !MEDICINE_BLOCKLIST.has(w.toLowerCase()));
  
  const filteredName = nonBlockWords.join(' ');
  if (!/[a-zA-Z]{3}/.test(filteredName)) return false;
  
  if (/^\d+[-–]\d+[-–]\d+$/.test(t)) return false;
  return true;
}

interface PrescriptionAnalysis {
  medicines: string[];
  prescriptionInfo: {
    doctorName?: string;
    patientName?: string;
    date?: string;
    diagnosis?: string;
  };
}

function analyzeText(text: string): PrescriptionAnalysis {
  const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const info: PrescriptionAnalysis['prescriptionInfo'] = {};

  // Parse metadata
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const lineLower = line.toLowerCase();
    
    if (!info.doctorName && /\bdr\.?\s+[a-z]/i.test(line)) {
      const m = line.match(/\bdr\.?\s+([a-zA-Z\s]{3,40})/i);
      if (m?.[1]) info.doctorName = toTitleCase(m[1].trim().replace(/[,;:]+$/, ''));
    }
    if (!info.patientName && /^(patient|patient name|name)\s*:/i.test(line)) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      info.patientName = afterColon.length > 2 ? toTitleCase(afterColon.replace(/[,;:]+$/, '')) : toTitleCase(allLines[i + 1] || '');
    }
    if (!info.date) {
      const dm = line.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
      if (dm?.[1]) info.date = dm[1];
    }
    if (!info.diagnosis && /^(diagnosis|complaints?|presenting complaint[s]?|chief complaint[s]?)\s*:/i.test(line)) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      info.diagnosis = afterColon.length > 2 ? toTitleCase(afterColon.replace(/[,;]+$/, '')) : toTitleCase(allLines[i + 1] || '');
    }
    if (!info.diagnosis && /^complaints?\s*$/i.test(lineLower) && allLines[i + 1]) {
      const nextLine = allLines[i + 1].trim();
      if (nextLine.length > 2 && !nextLine.match(/^[A-Z][a-z]+\s*:/)) {
        info.diagnosis = toTitleCase(nextLine);
      }
    }
  }

  // Find Rx section bounds
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

  const sectionLines = allLines.slice(startIdx, endIdx);
  const rawNames: string[] = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    let candidate: string | null = null;

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
      if (isValidMedicine(cleaned)) {
        const words = cleaned.split(/\s+/);
        const nonBlockWords = words.filter((w) => !MEDICINE_BLOCKLIST.has(w.toLowerCase().trim()));
        if (nonBlockWords.length > 0) rawNames.push(cleaned);
      }
    }
  }

  // Fallback
  if (rawNames.length === 0) {
    for (const line of allLines) {
      if (!DOSAGE_UNITS_RE.test(line)) continue;
      const cleaned = cleanMedicineName(line);
      if (isValidMedicine(cleaned)) {
        const words = cleaned.split(/\s+/);
        const nonBlockWords = words.filter((w) => !MEDICINE_BLOCKLIST.has(w.toLowerCase().trim()));
        if (nonBlockWords.length > 0) rawNames.push(cleaned);
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const medicines: string[] = [];
  for (const raw of rawNames) {
    const key = raw.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      medicines.push(toTitleCase(raw));
    }
  }

  return { medicines, prescriptionInfo: info };
}

/**
 * POST /api/prescription/analyze
 * Body: { text: string }
 *
 * Accepts raw OCR text from the frontend and returns:
 * - medicines: string[]
 * - prescriptionInfo: { doctorName, patientName, date, diagnosis }
 */
export const analyzePrescriptionText = (req: Request, res: Response): void => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ message: 'Request body must include a non-empty "text" field.' });
    return;
  }

  if (text.length > 50_000) {
    res.status(400).json({ message: 'Text exceeds maximum allowed length (50,000 characters).' });
    return;
  }

  const result = analyzeText(text);
  res.json({ success: true, ...result });
};
