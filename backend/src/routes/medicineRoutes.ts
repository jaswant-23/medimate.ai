import express from 'express';
import {
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getMedicineById,
  getMedicinesByProfile,
  adjustStock
} from '../controllers/medicineController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', addMedicine);
router.post('/:id/stock', adjustStock);
router.route('/:id')
  .get(getMedicineById)
  .put(updateMedicine)
  .delete(deleteMedicine);

router.get('/profile/:profileId', getMedicinesByProfile);

export default router;
