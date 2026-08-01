import { Response } from 'express';
import { PrismaClient, DoseInstruction, ReminderRepeatType, DoseStatus, StockChangeReason } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendDailyDigestEmail } from '../utils/email';
import { checkAndUpdateRefillAlerts } from '../utils/refillEngine';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export const createReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      profileId,
      medicineId,
      doseAmount,
      doseUnit,
      instruction,
      repeatType,
      daysOfWeek,
      intervalDays,
      startDate,
      endDate,
      times
    } = req.body;

    if (!profileId || !medicineId || doseAmount === undefined || !doseUnit || !repeatType || !startDate || !times || !Array.isArray(times)) {
      res.status(400).json({ message: 'Missing required fields or invalid times array' });
      return;
    }

    // Verify profile ownership
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    // Verify medicine ownership
    const medicine = await prisma.medicine.findUnique({ 
      where: { id: medicineId },
      include: { profile: true } 
    });
    if (!medicine || medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this medicine' });
      return;
    }

    const reminder = await prisma.reminder.create({
      data: {
        profileId,
        medicineId,
        doseAmount: parseFloat(doseAmount),
        doseUnit,
        instruction: (instruction as DoseInstruction) || DoseInstruction.NONE,
        repeatType: (repeatType as ReminderRepeatType),
        daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek.map(Number) : [],
        intervalDays: intervalDays !== undefined ? parseInt(intervalDays) : null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        times
      }
    });

    res.status(201).json(reminder);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRemindersByMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const medicineId = req.params.medicineId as string;

    const medicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
      include: { profile: true }
    });

    if (!medicine || medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this medicine' });
      return;
    }

    const reminders = await prisma.reminder.findMany({
      where: { medicineId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRemindersByProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.params.profileId as string;

    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    const reminders = await prisma.reminder.findMany({
      where: { profileId },
      include: { medicine: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(reminders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      doseAmount,
      doseUnit,
      instruction,
      repeatType,
      daysOfWeek,
      intervalDays,
      startDate,
      endDate,
      times,
      isActive
    } = req.body;

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!reminder) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }

    if (reminder.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this reminder' });
      return;
    }

    const updateData: any = {};
    if (doseAmount !== undefined) updateData.doseAmount = parseFloat(doseAmount);
    if (doseUnit !== undefined) updateData.doseUnit = doseUnit;
    if (instruction !== undefined) updateData.instruction = instruction as DoseInstruction;
    if (repeatType !== undefined) updateData.repeatType = repeatType as ReminderRepeatType;
    if (daysOfWeek !== undefined) updateData.daysOfWeek = Array.isArray(daysOfWeek) ? daysOfWeek.map(Number) : [];
    if (intervalDays !== undefined) updateData.intervalDays = intervalDays !== null ? parseInt(intervalDays) : null;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (times !== undefined) updateData.times = times;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.reminder.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!reminder) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }

    if (reminder.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this reminder' });
      return;
    }

    await prisma.reminder.delete({ where: { id } });
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleReminderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!reminder) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }

    if (reminder.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this reminder' });
      return;
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: { isActive: !reminder.isActive }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const logDose = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reminderId, status, scheduledAt, snoozeCount } = req.body;

    if (!reminderId || !status || !scheduledAt) {
      res.status(400).json({ message: 'Reminder ID, status, and scheduled time are required' });
      return;
    }

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { profile: true }
    });

    if (!reminder) {
      res.status(404).json({ message: 'Reminder not found' });
      return;
    }

    if (reminder.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this reminder' });
      return;
    }

    const targetDate = new Date(scheduledAt);

    // Check if log already exists
    const existingLog = await prisma.doseLog.findFirst({
      where: {
        reminderId,
        scheduledAt: targetDate
      }
    });

    let doseLog;
    let statusChanged = false;
    let oldStatus: DoseStatus | null = null;

    if (existingLog) {
      oldStatus = existingLog.status;
      statusChanged = oldStatus !== status;
      doseLog = await prisma.doseLog.update({
        where: { id: existingLog.id },
        data: {
          status: status as DoseStatus,
          respondedAt: new Date(),
          snoozeCount: snoozeCount !== undefined ? parseInt(snoozeCount) : existingLog.snoozeCount
        }
      });
    } else {
      statusChanged = true;
      doseLog = await prisma.doseLog.create({
        data: {
          reminderId,
          profileId: reminder.profileId,
          scheduledAt: targetDate,
          status: status as DoseStatus,
          respondedAt: new Date(),
          snoozeCount: snoozeCount !== undefined ? parseInt(snoozeCount) : 0
        }
      });
    }

    // Auto-adjust stock if status changed
    if (statusChanged) {
      const medicine = await prisma.medicine.findUnique({
        where: { id: reminder.medicineId }
      });

      if (medicine) {
        let newQty = medicine.quantityAvailable;
        let changeAmount = 0;
        let reason: StockChangeReason = StockChangeReason.DOSE_TAKEN;

        if (status === 'TAKEN' && oldStatus !== 'TAKEN') {
          // Decrement stock
          changeAmount = -reminder.doseAmount;
          newQty = Math.max(0, medicine.quantityAvailable - reminder.doseAmount);
          reason = StockChangeReason.DOSE_TAKEN;
        } else if (status !== 'TAKEN' && oldStatus === 'TAKEN') {
          // Increment stock (revert taken dose)
          changeAmount = reminder.doseAmount;
          newQty = medicine.quantityAvailable + reminder.doseAmount;
          reason = StockChangeReason.MANUAL_ADJUSTMENT;
        }

        if (changeAmount !== 0) {
          await prisma.medicine.update({
            where: { id: medicine.id },
            data: { quantityAvailable: newQty }
          });

          // Create stock history record
          await prisma.stockHistory.create({
            data: {
              medicineId: medicine.id,
              changeAmount,
              reason,
              balanceAfter: newQty
            }
          });

          // Update refill alerts
          await checkAndUpdateRefillAlerts(medicine.id, prisma);
        }
      }
    }

    res.status(201).json(doseLog);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoseLogsByProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.params.profileId as string;

    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    const logs = await prisma.doseLog.findMany({
      where: { profileId },
      include: {
        reminder: {
          include: {
            medicine: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const triggerDailyDigest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Get all user profiles
    const profiles = await prisma.profile.findMany({
      where: { ownerId: user.id }
    });

    const profileIds = profiles.map(p => p.id);

    // Get all active reminders for these profiles
    const reminders = await prisma.reminder.findMany({
      where: {
        profileId: { in: profileIds },
        isActive: true
      },
      include: {
        medicine: true,
        profile: true
      }
    });

    // Filter reminders that occur today
    const today = new Date();
    const todayDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    today.setHours(0, 0, 0, 0);

    const todayReminders = reminders.filter(r => {
      // Check date bounds
      const start = new Date(r.startDate);
      start.setHours(0, 0, 0, 0);
      if (today.getTime() < start.getTime()) return false;

      if (r.endDate) {
        const end = new Date(r.endDate);
        end.setHours(0, 0, 0, 0);
        if (today.getTime() > end.getTime()) return false;
      }

      // Check pattern
      if (r.repeatType === 'DAILY') {
        return true;
      } else if (r.repeatType === 'WEEKLY') {
        return r.daysOfWeek.includes(todayDayOfWeek);
      } else if (r.repeatType === 'CUSTOM_INTERVAL') {
        const diffTime = today.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const interval = r.intervalDays || 1;
        return diffDays % interval === 0;
      } else if (r.repeatType === 'COURSE') {
        return true; // Bounded by start/end date check above
      }

      return false;
    });

    // Send daily digest email if there are reminders
    if (todayReminders.length > 0) {
      await sendDailyDigestEmail(user.email, todayReminders);
      res.json({ message: `Daily digest sent successfully with ${todayReminders.length} reminder(s).` });
    } else {
      res.json({ message: 'No reminders scheduled for today. Digest email skipped.' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
