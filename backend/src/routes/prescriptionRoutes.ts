import express from 'express';
import { analyzePrescriptionText } from '../controllers/prescriptionController';

const router = express.Router();

/**
 * POST /api/prescription/analyze
 * Accepts raw OCR text, returns extracted medicines + prescription metadata.
 * No auth required — purely text processing.
 */
router.post('/analyze', analyzePrescriptionText);

export default router;
