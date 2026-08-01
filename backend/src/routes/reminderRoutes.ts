import express from 'express';
import {
  createReminder,
  getRemindersByMedicine,
  getRemindersByProfile,
  updateReminder,
  deleteReminder,
  toggleReminderStatus,
  logDose,
  getDoseLogsByProfile,
  triggerDailyDigest
} from '../controllers/reminderController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', createReminder);
router.get('/medicine/:medicineId', getRemindersByMedicine);
router.get('/profile/:profileId', getRemindersByProfile);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);
router.patch('/:id/toggle', toggleReminderStatus);

router.post('/dose-logs', logDose);
router.get('/dose-logs/profile/:profileId', getDoseLogsByProfile);
router.post('/daily-digest', triggerDailyDigest);

export default router;
