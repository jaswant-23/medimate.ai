/**
 * OCR.space Free API Client + Medicine Name Extraction
 *
 * Calls the OCR.space API directly from the browser, then runs
 * the same NLP / regex extraction strategies that were previously
 * in the backend medicineController.
 *
 * Env variable required: VITE_OCR_API_KEY
 */

const OCR_API_URL = 'https://api.ocr.space/parse/image';
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB (free-tier limit)

export interface OcrResult {
  /** Raw text returned by the OCR engine */
  text: string;
  /** Extracted & deduplicated medicine names */
  medicines: string[];
}

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Validate the image file before sending it to OCR.space.
 * Throws a user-friendly error if validation fails.
 */
function validateFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (JPG, PNG, BMP, GIF, TIFF) are supported.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Image size (${sizeMB} MB) exceeds the 1 MB limit. Please compress or crop the image before uploading.`
    );
  }
}

/**
 * Call the OCR.space Parse Image API and return the recognised text.
 */
async function callOcrApi(file: File, ocrEngine: number = 2): Promise<string> {
  const apiKey = import.meta.env.VITE_OCR_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OCR API key is not configured. Add VITE_OCR_API_KEY to your .env file.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('apikey', apiKey);
  formData.append('OCREngine', String(ocrEngine));
  formData.append('isTable', 'true');
  formData.append('language', 'eng');

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      `OCR service returned HTTP ${response.status}. Please try again later.`
    );
  }

  const data = await response.json();

  // OCR.space error handling
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

  // Concatenate text from all parsed pages / regions
  return data.ParsedResults.map(
    (r: { ParsedText?: string }) => r.ParsedText || ''
  ).join('\n');
}

// ── Words / phrases to strip from medicine names ──
const HEADER_WORDS = [
  'NAME', 'DATE', 'AGE', 'GENDER', 'MALE', 'FEMALE',
  'DIAGNOSIS', 'SYMPTOM', 'DAILY', 'TAKE', 'DAY', 'REFILL',
  'DOCTOR', 'PATIENT', 'CLINIC', 'HOSPITAL', 'ADVICE', 'TESTS',
  'REG', 'SECTOR', 'NOIDA', 'YRS', 'DURATION', 'DAYS',
  'RX', 'DR', 'MD', 'MR', 'MRS', 'MS',
];

/**
 * Trim trailing metadata from a medicine name string.
 * Strips things like "Duration: 7 Days", dosage amounts, parenthetical info, etc.
 */
function cleanMedicineName(raw: string): string {
  let name = raw;

  // Remove parenthetical content like "(Benzalkonium Cl + Pramoxine HCl)"
  name = name.replace(/\(.*?\)/g, '').trim();

  // Remove trailing metadata starting with known keywords
  name = name.replace(/\b(duration|dose|dosage|frequency|qty|quantity|take|route|times|once|twice|thrice)\b.*/i, '').trim();

  // Remove trailing numbers + units (e.g. "500mg", "7 Days")
  name = name.replace(/\s+\d+\s*(mg|ml|mcg|g|days?|tablets?|capsules?|times?)\b.*/i, '').trim();

  // Remove any trailing punctuation / whitespace
  name = name.replace(/[.,;:\-–—]+$/, '').trim();

  return name;
}

/**
 * Convert to Title Case: "BETADINE CLEAR SPRAY" → "Betadine Clear Spray"
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Check if a string looks like a real medicine name (not a header or junk).
 */
function isValidMedicineName(name: string): boolean {
  if (name.length < 3) return false;
  const upper = name.toUpperCase();
  // Reject if the entire name is a single header word
  if (HEADER_WORDS.includes(upper)) return false;
  // Reject if it's only numbers / special chars
  if (/^[\d\s.,;:-]+$/.test(name)) return false;
  return true;
}

/**
 * Extract potential medicine names from raw OCR text.
 *
 * Strategies (tried in order):
 *   1. Numbered lists  → capture the FULL line after the number
 *   2. Lines with dosage indicators → capture everything BEFORE the dosage
 *   3. Fallback → consecutive uppercase words (>4 chars each)
 */
function extractMedicineNames(text: string): string[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const rawMedicines: string[] = [];

  console.log(`[OCR Extract] Processing ${lines.length} lines...`);

  // ── Strategy 1: Numbered lists ──
  // e.g. "1. MAXIMUM STRENGTH BETADINE CLEAR SPRAY  Duration: 7 Days"
  // Captures everything after "1. " / "1) " up to end of line, then cleans it.
  const numberedRegex = /^\d+[.)]\s+(.+)/i;
  for (const line of lines) {
    const match = line.match(numberedRegex);
    if (match?.[1]) {
      const cleaned = cleanMedicineName(match[1]);
      if (isValidMedicineName(cleaned)) {
        rawMedicines.push(cleaned);
        console.log(`[OCR Extract] Strategy 1 (numbered list): "${line}" → "${cleaned}"`);
      }
    }
  }

  // ── Strategy 2: Lines with dosage indicators ──
  // e.g. "Amoxicillin 500mg tablet" → "Amoxicillin"
  if (rawMedicines.length === 0) {
    for (const line of lines) {
      if (/\b(mg|ml|mcg|tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler)\b/i.test(line)) {
        // Take everything before the first dosage/form indicator
        const beforeDosage = line
          .replace(/\b\d+\s*(mg|ml|mcg|g)\b.*/i, '')
          .replace(/\b(tablet|capsule|syrup|drop|spray|cream|ointment|injection|inhaler)s?\b.*/i, '')
          .trim();

        const cleaned = cleanMedicineName(beforeDosage);
        if (isValidMedicineName(cleaned)) {
          rawMedicines.push(cleaned);
          console.log(`[OCR Extract] Strategy 2 (dosage line): "${line}" → "${cleaned}"`);
        }
      }
    }
  }

  // ── Strategy 3: Fallback — gather consecutive uppercase words ──
  if (rawMedicines.length === 0) {
    for (const line of lines) {
      // Find sequences of capitalized words (at least 2 chars each)
      const capsMatches = line.match(/\b[A-Z][A-Za-z]{1,}(?:\s+[A-Z][A-Za-z]{1,})*\b/g);
      if (capsMatches) {
        for (const phrase of capsMatches) {
          // Skip header-like phrases
          const words = phrase.split(/\s+/);
          const nonHeaderWords = words.filter((w) => !HEADER_WORDS.includes(w.toUpperCase()));
          if (nonHeaderWords.length >= 1 && phrase.length > 4) {
            rawMedicines.push(phrase);
            console.log(`[OCR Extract] Strategy 3 (caps fallback): "${line}" → "${phrase}"`);
          }
        }
      }
    }
  }

  // Deduplicate and format as Title Case
  const deduplicated = [...new Set(rawMedicines.map((m) => m.toUpperCase()))];
  const result = deduplicated
    .filter((med) => isValidMedicineName(med))
    .map((med) => toTitleCase(med));

  return result;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * End-to-end: validate → OCR → extract medicine names.
 *
 * @param imageFile  The prescription image selected by the user
 * @param ocrEngine  OCR.space engine to use (1 | 2 | 3), default 2
 * @returns          `{ text, medicines }`
 */
export async function extractMedicinesFromImage(
  imageFile: File,
  ocrEngine: number = 2
): Promise<OcrResult> {
  validateFile(imageFile);

  const text = await callOcrApi(imageFile, ocrEngine);

  // ── Detailed console logging ──
  console.log('%c╔══════════════════════════════════════════╗', 'color: #0ea5e9; font-weight: bold');
  console.log('%c║     OCR.space API Response               ║', 'color: #0ea5e9; font-weight: bold');
  console.log('%c╚══════════════════════════════════════════╝', 'color: #0ea5e9; font-weight: bold');
  console.log('%cRaw OCR Text:', 'color: #f59e0b; font-weight: bold');
  console.log(text);
  console.log('%c──── Line-by-line breakdown ────', 'color: #8b5cf6; font-weight: bold');
  text.split('\n').forEach((line, i) => {
    if (line.trim()) {
      console.log(`  Line ${i + 1}: "${line.trim()}"`);
    }
  });
  console.log('%c────────────────────────────────', 'color: #8b5cf6; font-weight: bold');

  const medicines = extractMedicineNames(text);

  console.log('%c✅ Final Extracted Medicines:', 'color: #22c55e; font-weight: bold; font-size: 14px');
  medicines.forEach((med, i) => {
    console.log(`  ${i + 1}. ${med}`);
  });
  console.log('%c════════════════════════════════', 'color: #0ea5e9; font-weight: bold');

  return { text, medicines };
}
