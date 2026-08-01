import express from 'express';
import { getRefillAlerts, updateRefillAlertStatus } from '../controllers/refillController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/profile/:profileId', getRefillAlerts);
router.put('/:id/status', updateRefillAlertStatus);

export default router;
