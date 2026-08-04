import express from 'express';
import {
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getMedicineById,
  getMedicinesByProfile,
  adjustStock,
  extractPrescription
} from '../controllers/medicineController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/upload';
const router = express.Router();

// Public Routes
router.post('/extract-prescription', upload.single('prescription'), extractPrescription);

// Protected Routes
router.use(protect);

router.post('/', addMedicine);
router.post('/:id/stock', adjustStock);
router.route('/:id')
  .get(getMedicineById)
  .put(updateMedicine)
  .delete(deleteMedicine);

router.get('/profile/:profileId', getMedicinesByProfile);

export default router;
