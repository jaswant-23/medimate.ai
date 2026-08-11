/**
 * OCR.space Free API Client + Smart Medicine Name Extraction
 *
 * Two-stage pipeline:
 *   Stage 1 — OCR.space API gives us raw text
 *   Stage 2 — Smart extraction: find Rx section → extract medicine lines only
 *
 * Env variable required: VITE_OCR_API_KEY
 */

const OCR_API_URL = 'https://api.ocr.space/parse/image';
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB (free-tier limit)

// ── Public Types ─────────────────────────────────────────────────

export interface PrescriptionInfo {
  /** Parsed doctor name, if detected */
  doctorName?: string;
  /** Parsed patient name, if detected */
  patientName?: string;
  /** Parsed date string, if detected */
  date?: string;
  /** Parsed diagnosis / complaint, if detected */
  diagnosis?: string;
  /** Raw medicine section lines (for display: "Azithromycin 500 mg | 1-0-1 | 5 Days") */
  rawMedicineLines?: string[];
}

export interface OcrResult {
  /** Raw text returned by the OCR engine */
  text: string;
  /** Extracted & deduplicated medicine names (clean, ready for FDA search) */
  medicines: string[];
  /** Structured prescription metadata for display only */
  prescriptionInfo: PrescriptionInfo;
}

// ── File Validation ───────────────────────────────────────────────

function validateFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPG, PNG, BMP, GIF, TIFF) are supported.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Image size (${sizeMB} MB) exceeds the 1 MB limit. Please compress or crop the image.`
    );
  }
}

// ── OCR API Call ──────────────────────────────────────────────────

async function callOcrApi(file: File, ocrEngine: number = 2): Promise<string> {
  const apiKey = import.meta.env.VITE_OCR_API_KEY;
  if (!apiKey) {
    throw new Error('OCR API key is not configured. Add VITE_OCR_API_KEY to your .env file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('apikey', apiKey);
  formData.append('OCREngine', String(ocrEngine));
  formData.append('isTable', 'true');
  formData.append('language', 'eng');

  const response = await fetch(OCR_API_URL, { method: 'POST', body: formData });
  if (!response.ok) {
    throw new Error(`OCR service returned HTTP ${response.status}. Please try again later.`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    const errorMsg =
      data.ErrorMessage?.[0] ||
      data.ParsedResults?.[0]?.ErrorMessage ||
      'OCR processing failed. Please try a clearer image.';
    throw new Error(errorMsg);
  }

  if (!data.ParsedResults || data.ParsedResults.length === 0) {
    throw new Error('No text could be extracted from the image.');
  }

  return data.ParsedResults.map(
    (r: { ParsedText?: string }) => r.ParsedText || ''
  ).join('\n');
}

// ── Constants ─────────────────────────────────────────────────────

/**
 * Markers that signal the START of a medicine/prescription section.
 * If any line contains one of these, everything AFTER that line
 * is treated as the medicine section.
 */
const RX_START_MARKERS = [
  /\bRx\b/i,
  /\bR\/\b/i,
  /\bPx\b/i, // common OCR misread of Rx
  /\bBx\b/i, // another common OCR misread
  /\bMedicine[s]?\s*:/i,
  /\bDrug[s]?\s*:/i,
  /\bPrescription\s*:/i,
  /\bMedicine\s+Dosage\b/i,
  /\bDrug\s+Name\b/i,
  /\bTab\./i,
  /\bCap\./i,
  /\bSyrup\b/i,
];

/**
 * Markers that signal the END of the medicine section.
 * Once a line matches, stop processing.
 */
const RX_END_MARKERS = [
  /\bFollow[\s-]*Up\b/i,
  /\bAdvice\b/i,
  /\bNotes?\b/i,
  /\bConsultation\s*Fee\b/i,
  /\bSignature\b/i,
  /\bDiagnosis\b/i,
  /\bComplaint[s]?\b/i,
  /\bSymptons?\b/i,
  /\bTests?\b/i,
  /\bInvestigation[s]?\b/i,
];

/**
 * Dosage units that identify a line as a medicine line.
 * Requires a number before g/mg/ml to avoid matching random letters like 'G',
 * or matches explicit dosage forms like tablet/syrup.
 */
const DOSAGE_UNITS_RE = /(?:\b\d+(?:\.\d+)?\s*(?:g|mg|ml|mcg|iu|units?)\b)|\b(tablet[s]?|capsule[s]?|cap[s]?|tab[s]?|syrup|drop[s]?|spray|cream|ointment|injection|inhaler|lotion|gel|patch)\b/i;

/**
 * Dosage schedule indicators (after the medicine name).
 * Used to split "Azithromycin 500mg 1-0-1 5 days" → "Azithromycin"
 */
const DOSAGE_SCHEDULE_RE = /\b(\d[-–]\d[-–]\d|\d+\s*[-–]\s*\d+\s*[-–]\s*\d+|OD|BD|TDS|QID|SOS|PRN|HS|AC|PC|STAT)\b/i;

/**
 * Expanded blocklist of words that are NEVER medicine names.
 * Checked against the entire extracted candidate (case-insensitive).
 */
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

// ── Helper Functions ──────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isBlocklisted(word: string): boolean {
  return MEDICINE_BLOCKLIST.has(word.toLowerCase().trim());
}

function isValidMedicineName(name: string): boolean {
  const trimmed = name.trim();
  // Must be at least 4 characters
  if (trimmed.length < 4) return false;
  // Must not be purely numeric or symbolic
  if (/^[\d\s.,;:–—/\\|-]+$/.test(trimmed)) return false;
  
  // Clean string to check against blocklist (convert "Age:" -> "Age")
  const words = trimmed.replace(/[.,;:–—/\\|()-]/g, ' ').split(/\s+/).filter(Boolean);
  const nonBlockWords = words.filter(w => !isBlocklisted(w));
  
  // Must contain at least one letter sequence of 3+ chars AFTER blocklist filtering
  const filteredName = nonBlockWords.join(' ');
  if (!/[a-zA-Z]{3}/.test(filteredName)) return false;
  
  // Must not be a number pattern like "500" or "1-0-1"
  if (/^\d+[-–]\d+[-–]\d+$/.test(trimmed)) return false;
  return true;
}

/**
 * Remove dosage strength, schedule, duration from a candidate medicine name.
 * "Azithromycin 500 mg 1-0-1 5 Days" → "Azithromycin"
 */
function cleanMedicineName(raw: string): string {
  let name = raw.trim();

  // Remove parenthetical content: "(Benzalkonium Cl + Pramoxine HCl)"
  name = name.replace(/\(.*?\)/g, '').trim();

  // Remove dosage schedule like "1-0-1", "OD", "BD", "TDS"
  name = name.replace(DOSAGE_SCHEDULE_RE, '').trim();

  // Remove trailing strength + unit: "500 mg", "250mg", "5 ml" (and everything after it)
  // This allows "Azithromycin 500mg 1-0-0" to become "Azithromycin"
  name = name.replace(/\s*(?:-?\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|iu|units?)\b).*/i, '').trim();

  // Remove trailing duration: "5 days", "7 weeks", "1 month"
  name = name.replace(/\s+\d+\s*(days?|weeks?|months?)\b.*/i, '').trim();

  // Remove trailing dosage form if it somehow slipped through
  name = name.replace(/\s+(tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler|gel|lotion|patch)s?\b.*/i, '').trim();

  // Remove trailing metadata keywords
  name = name.replace(/\b(duration|dose|dosage|frequency|qty|quantity|take|route|times|once|twice|thrice)\b.*/i, '').trim();

  // Remove trailing punctuation
  name = name.replace(/[.,;:–—/\\-]+$/, '').trim();

  return name;
}

// ── Stage 1: Find the Medicine Section ──────────────────────────

/**
 * Given all lines, find the start and end indices of the medicine/Rx section.
 * Returns { startIdx, endIdx } — the slice to process.
 */
function findMedicineSectionBounds(lines: string[]): { startIdx: number; endIdx: number } {
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Look for Rx section start marker
    if (startIdx === -1) {
      const isStartMarker = RX_START_MARKERS.some((re) => re.test(line));
      if (isStartMarker) {
        startIdx = i + 1; // start AFTER the marker line
        continue;
      }
    }

    // If we've found the start, look for end markers
    if (startIdx !== -1) {
      const isEndMarker = RX_END_MARKERS.some((re) => re.test(line));
      if (isEndMarker) {
        endIdx = i;
        break;
      }
    }
  }

  // If no Rx marker found, process all lines (fallback)
  if (startIdx === -1) {
    startIdx = 0;
  }

  return { startIdx, endIdx };
}

// ── Stage 2: Extract Medicines From Section Lines ────────────────

function extractFromSection(sectionLines: string[]): { names: string[]; rawLines: string[] } {
  const rawNames: string[] = [];
  const rawLines: string[] = [];

  // Strategy A: Numbered list — "1. Azithromycin 500 mg"
  const numberedRegex = /^[\d]+[.)]\s+(.+)/;
  // Strategy B: Bullet / dash list — "- Azithromycin 500 mg"
  const bulletRegex = /^[-•*]\s+(.+)/;
  // Strategy C: Tab/Cap prefix — "Tab. Azithromycin" or "Tab Azithromycin"
  const tabCapRegex = /^(?:Tab\.?|Cap\.?|Syrup\.?|Inj\.?)\s+(.+)/i;

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    let candidate: string | null = null;

    // Try Strategy A
    const numMatch = trimmed.match(numberedRegex);
    if (numMatch?.[1]) {
      candidate = numMatch[1];
    }

    // Try Strategy B
    if (!candidate) {
      const bulletMatch = trimmed.match(bulletRegex);
      if (bulletMatch?.[1]) {
        candidate = bulletMatch[1];
      }
    }

    // Try Strategy C (Tab. / Cap.)
    if (!candidate) {
      const tcMatch = trimmed.match(tabCapRegex);
      if (tcMatch?.[1]) {
        candidate = tcMatch[1];
      }
    }

    // Strategy D: Any line containing a dosage unit is a medicine line
    if (!candidate && DOSAGE_UNITS_RE.test(trimmed)) {
      // Use the whole line and let cleanMedicineName handle the unit stripping
      candidate = trimmed;
    }

    if (candidate) {
      rawLines.push(trimmed);
      const cleaned = cleanMedicineName(candidate);
      if (isValidMedicineName(cleaned)) {
        // Make sure none of the words are purely blocklisted
        const words = cleaned.split(/\s+/);
        const nonBlockWords = words.filter((w) => !isBlocklisted(w));
        if (nonBlockWords.length > 0) {
          rawNames.push(cleaned);
        }
      }
    }
  }

  return { names: rawNames, rawLines };
}

// ── Stage 3: Fallback if Section-Based Extraction Yields Nothing ─

function fallbackExtraction(lines: string[]): string[] {
  const rawNames: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Only process lines that contain a dosage unit
    if (!DOSAGE_UNITS_RE.test(trimmed)) continue;

    // Use the whole line since cleanMedicineName strips everything after and including the unit
    const candidate = cleanMedicineName(trimmed);

    if (isValidMedicineName(candidate)) {
      const words = candidate.split(/\s+/);
      const nonBlockWords = words.filter((w) => !isBlocklisted(w));
      if (nonBlockWords.length > 0) {
        rawNames.push(candidate);
      }
    }
  }

  return rawNames;
}

// ── Stage 4: Parse Prescription Metadata ────────────────────────

function parsePrescriptionInfo(lines: string[]): PrescriptionInfo {
  const info: PrescriptionInfo = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lineLower = line.toLowerCase();

    // Doctor name — lines containing "Dr." or "Doctor:"
    if (!info.doctorName && /\bdr\.?\s+[a-z]/i.test(line)) {
      const match = line.match(/\bdr\.?\s+([a-zA-Z\s]{3,40})/i);
      if (match?.[1]) {
        info.doctorName = toTitleCase(match[1].trim().replace(/[,;:]+$/, ''));
      }
    }

    // Patient name — line after "Patient:" or "Name:"
    if (!info.patientName && /^(patient|patient name|name)\s*:/i.test(line)) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon.length > 2) {
        info.patientName = toTitleCase(afterColon.replace(/[,;:]+$/, ''));
      } else if (lines[i + 1]) {
        info.patientName = toTitleCase(lines[i + 1].trim());
      }
    }

    // Date — line with a date pattern
    if (!info.date) {
      const dateMatch = line.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/);
      if (dateMatch?.[1]) {
        info.date = dateMatch[1];
      }
    }

    // Diagnosis / Complaints
    if (!info.diagnosis && /^(diagnosis|complaints?|presenting complaint[s]?|chief complaint[s]?)\s*:/i.test(line)) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon.length > 2) {
        info.diagnosis = toTitleCase(afterColon.replace(/[,;]+$/, ''));
      } else if (lines[i + 1] && lines[i + 1].trim().length > 2) {
        info.diagnosis = toTitleCase(lines[i + 1].trim());
      }
    }

    // Also match "Complaints" header without colon followed by next line
    if (!info.diagnosis && /^complaints?\s*$/i.test(lineLower) && lines[i + 1]) {
      const nextLine = lines[i + 1].trim();
      if (nextLine.length > 2 && !nextLine.match(/^[A-Z][a-z]+\s*:/)) {
        info.diagnosis = toTitleCase(nextLine);
      }
    }
  }

  return info;
}

// ── Main Extraction Orchestrator ──────────────────────────────────

export function extractMedicinesFromText(text: string): {
  medicines: string[];
  prescriptionInfo: PrescriptionInfo;
} {
  const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  console.log(`%c[MediMate OCR] Processing ${allLines.length} lines`, 'color: #8b5cf6; font-weight: bold');

  // Step 1: Parse prescription metadata from ALL lines
  const prescriptionInfo = parsePrescriptionInfo(allLines);
  console.log('%c[MediMate OCR] Prescription info:', 'color: #f59e0b; font-weight: bold', prescriptionInfo);

  // Step 2: Find Rx section bounds
  const { startIdx, endIdx } = findMedicineSectionBounds(allLines);
  const sectionLines = allLines.slice(startIdx, endIdx);

  console.log(
    `%c[MediMate OCR] Medicine section: lines ${startIdx}–${endIdx} (${sectionLines.length} lines)`,
    'color: #0ea5e9; font-weight: bold'
  );
  console.log('%c[MediMate OCR] Section lines:', 'color: #0ea5e9', sectionLines);

  // Step 3: Extract from section
  let { names, rawLines } = extractFromSection(sectionLines);
  prescriptionInfo.rawMedicineLines = rawLines;

  // Step 4: Fallback — if section extraction failed, try dosage-unit scan on all lines
  if (names.length === 0) {
    console.log('%c[MediMate OCR] Section extraction yielded nothing. Running fallback...', 'color: #f97316');
    names = fallbackExtraction(allLines);
  }

  // Step 5: Deduplicate & format
  const seen = new Set<string>();
  const finalMedicines: string[] = [];
  for (const raw of names) {
    const key = raw.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      finalMedicines.push(toTitleCase(raw));
    }
  }

  console.log(
    '%c[MediMate OCR] ✅ Final medicines extracted:',
    'color: #22c55e; font-weight: bold; font-size: 14px',
    finalMedicines
  );

  return { medicines: finalMedicines, prescriptionInfo };
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Full pipeline: validate → OCR → smart extraction.
 *
 * @param imageFile  The prescription image selected by the user
 * @param ocrEngine  OCR.space engine (1 | 2 | 3), default 2
 */
export async function extractMedicinesFromImage(
  imageFile: File,
  ocrEngine: number = 2
): Promise<OcrResult> {
  validateFile(imageFile);
  const text = await callOcrApi(imageFile, ocrEngine);

  console.log('%c╔══════════════════════════════════════════╗', 'color: #0ea5e9; font-weight: bold');
  console.log('%c║     MediMate OCR — Raw Text              ║', 'color: #0ea5e9; font-weight: bold');
  console.log('%c╚══════════════════════════════════════════╝', 'color: #0ea5e9; font-weight: bold');
  console.log('%cRaw OCR Text:', 'color: #f59e0b; font-weight: bold');
  console.log(text);
  console.log('%c────────────────────────────────────────────', 'color: #8b5cf6; font-weight: bold');

  const { medicines, prescriptionInfo } = extractMedicinesFromText(text);

  return { text, medicines, prescriptionInfo };
}

/**
 * Parse medicines from manually typed text (comma / newline separated).
 * Cleans and validates each entry.
 */
export function parseMedicinesFromText(input: string): string[] {
  const raw = input
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    const cleaned = cleanMedicineName(item);
    const key = cleaned.toLowerCase();
    if (cleaned.length >= 3 && !seen.has(key) && !isBlocklisted(cleaned)) {
      seen.add(key);
      result.push(toTitleCase(cleaned));
    }
  }

  return result;
}
