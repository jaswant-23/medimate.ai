import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          photoUrl: true,
          dob: true,
          gender: true,
          address: true,
          preferredLanguage: true,
          preferredUnits: true,
          theme: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          notificationPref: true,
        },
      });

      if (!req.user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }

      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const checkProfileAccess = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profileId = req.params.profileId || req.body.profileId || req.query.profileId;
    if (!profileId) {
      res.status(400).json({ message: 'Profile ID is required' });
      return;
    }

    const profile = await prisma.profile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    if (profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    // Attach profile to request for convenience in controllers
    (req as any).profile = profile;
    next();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
