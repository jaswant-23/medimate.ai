import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthRequest } from '../middleware/authMiddleware';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export const getRefillAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.params.profileId as string;

    if (!profileId) {
      res.status(400).json({ message: 'Profile ID is required' });
      return;
    }

    // Verify ownership of the profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId }
    });

    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    const now = new Date();

    const alerts = await prisma.refillAlert.findMany({
      where: {
        medicine: {
          profileId
        },
        OR: [
          { status: 'PENDING' },
          {
            status: 'SNOOZED',
            OR: [
              { snoozedUntil: null },
              { snoozedUntil: { lte: now } }
            ]
          }
        ]
      },
      include: {
        medicine: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateRefillAlertStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !['PENDING', 'REORDERED', 'DISMISSED', 'SNOOZED'].includes(status)) {
      res.status(400).json({ message: 'Valid status is required' });
      return;
    }

    const alert = await prisma.refillAlert.findUnique({
      where: { id },
      include: {
        medicine: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!alert) {
      res.status(404).json({ message: 'Refill alert not found' });
      return;
    }

    if (alert.medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this resource' });
      return;
    }

    let snoozedUntil = null;
    if (status === 'SNOOZED') {
      snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours of silence
    }

    const updatedAlert = await prisma.refillAlert.update({
      where: { id },
      data: {
        status,
        snoozedUntil
      },
      include: {
        medicine: true
      }
    });

    res.json(updatedAlert);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
