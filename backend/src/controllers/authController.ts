import 'dotenv/config';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { AuthRequest } from '../middleware/authMiddleware';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const generateToken = (id: string, expiresIn: string | number = '1h') => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, { expiresIn: expiresIn as any });
};

const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, fullName, email, password } = req.body;
    const resolvedName = fullName || name;

    if (!resolvedName || !email || !password) {
      res.status(400).json({ 
        message: 'Please provide all required fields',
        missing: {
          name: !resolvedName,
          email: !email,
          password: !password
        },
        received: {
          fullName: fullName || name,
          email,
          hasPassword: !!password
        }
      });
      return;
    }

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        fullName: resolvedName,
        email,
        passwordHash: hashedPassword,
        isEmailVerified: true,
        profiles: {
          create: {
            relation: 'SELF',
            fullName: resolvedName,
          }
        },
        notificationPref: {
          create: {}
        }
      }
    });

    // Generate Verification Token
    // const verificationToken = crypto.randomBytes(32).toString('hex');
    // await prisma.otpVerification.create({
    //   data: {
    //     userId: user.id,
    //     identifier: user.email!,
    //     otpCode: verificationToken,
    //     purpose: 'SIGNUP',
    //     expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    //   }
    // });

    // await sendVerificationEmail(user.email!, verificationToken);

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: refreshToken,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.status(201).json({
      message: 'User registered successfully.',
      _id: user.id,
      fullName: user.fullName,
      email: user.email,
      isEmailVerified: true,
      token: generateToken(user.id),
      refreshToken: refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
      // Create a refresh token in Session
      const refreshToken = generateRefreshToken();
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: refreshToken,
          userAgent: req.headers['user-agent'] || null,
          ipAddress: req.ip || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }
      });

      res.json({
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        token: generateToken(user.id),
        refreshToken: refreshToken,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const logoutUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await prisma.session.deleteMany({
        where: {
          refreshToken: refreshToken
        }
      });
    }
    
    res.json({ message: 'User logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await prisma.otpVerification.create({
      data: {
        userId: user.id,
        identifier: user.email!,
        otpCode: resetToken,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
      }
    });

    await sendPasswordResetEmail(user.email!, resetToken);
    res.json({ message: 'Password reset email sent' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const resetTokenRecord = await prisma.otpVerification.findFirst({
      where: {
        otpCode: token,
        purpose: 'PASSWORD_RESET',
        expiresAt: { gt: new Date() }, // not expired
        isVerified: false
      }
    });

    if (!resetTokenRecord || !resetTokenRecord.userId) {
      res.status(400).json({ message: 'Invalid or expired token' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: resetTokenRecord.userId },
      data: { passwordHash: hashedPassword }
    });

    await prisma.otpVerification.delete({ where: { id: resetTokenRecord.id } });

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    const verificationTokenRecord = await prisma.otpVerification.findFirst({
      where: {
        otpCode: token,
        purpose: 'SIGNUP',
        expiresAt: { gt: new Date() }
      }
    });

    if (!verificationTokenRecord || !verificationTokenRecord.userId) {
      res.status(400).json({ message: 'Invalid verification token' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: verificationTokenRecord.userId },
      data: { isEmailVerified: true }
    });

    await prisma.otpVerification.delete({ where: { id: verificationTokenRecord.id } });

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: updatedUser.id,
        refreshToken,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.json({
      message: 'Email verified successfully',
      _id: updatedUser.id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      isEmailVerified: updatedUser.isEmailVerified,
      token: generateToken(updatedUser.id),
      refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token required' });
      return;
    }

    const sessionRecord = await prisma.session.findFirst({
      where: {
        refreshToken: refreshToken,
        expiresAt: { gt: new Date() }
      }
    });

    if (!sessionRecord) {
      res.status(403).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const newAccessToken = generateToken(sessionRecord.userId);
    res.json({ token: newAccessToken });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (user) {
      res.json({
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        photoUrl: user.photoUrl,
        dob: user.dob,
        gender: user.gender,
        address: user.address,
        preferredLanguage: user.preferredLanguage,
        preferredUnits: user.preferredUnits,
        theme: user.theme,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        isActive: user.isActive,
        notificationPref: user.notificationPref,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { 
      fullName, 
      phone, 
      photoUrl, 
      dob, 
      gender, 
      address, 
      preferredLanguage, 
      preferredUnits, 
      theme,
      notificationPref 
    } = req.body;

    const dataToUpdate: any = {
      fullName: fullName !== undefined ? fullName : user.fullName,
      phone: phone !== undefined ? phone : user.phone,
      photoUrl: photoUrl !== undefined ? photoUrl : user.photoUrl,
      dob: dob !== undefined ? (dob ? new Date(dob) : null) : user.dob,
      gender: gender !== undefined ? gender : user.gender,
      address: address !== undefined ? address : user.address,
      preferredLanguage: preferredLanguage !== undefined ? preferredLanguage : user.preferredLanguage,
      preferredUnits: preferredUnits !== undefined ? preferredUnits : user.preferredUnits,
      theme: theme !== undefined ? theme : user.theme,
    };

    if (notificationPref !== undefined) {
      dataToUpdate.notificationPref = {
        upsert: {
          create: {
            medicineReminders: notificationPref.medicineReminders ?? true,
            stockAlerts: notificationPref.stockAlerts ?? true,
            expiryAlerts: notificationPref.expiryAlerts ?? true,
            refillAlerts: notificationPref.refillAlerts ?? true,
            donationAlerts: notificationPref.donationAlerts ?? true,
            calendarReminders: notificationPref.calendarReminders ?? true,
            quietHoursStart: notificationPref.quietHoursStart || null,
            quietHoursEnd: notificationPref.quietHoursEnd || null,
            expiryThreshold: notificationPref.expiryThreshold !== undefined ? Number(notificationPref.expiryThreshold) : 30,
          },
          update: {
            medicineReminders: notificationPref.medicineReminders,
            stockAlerts: notificationPref.stockAlerts,
            expiryAlerts: notificationPref.expiryAlerts,
            refillAlerts: notificationPref.refillAlerts,
            donationAlerts: notificationPref.donationAlerts,
            calendarReminders: notificationPref.calendarReminders,
            quietHoursStart: notificationPref.quietHoursStart,
            quietHoursEnd: notificationPref.quietHoursEnd,
            expiryThreshold: notificationPref.expiryThreshold !== undefined ? Number(notificationPref.expiryThreshold) : undefined,
          }
        }
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: dataToUpdate,
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
        notificationPref: true,
      }
    });

    // Sync to SELF profile
    await prisma.profile.updateMany({
      where: { ownerId: user.id, relation: 'SELF' },
      data: {
        fullName: updatedUser.fullName,
        photoUrl: updatedUser.photoUrl,
        dob: updatedUser.dob,
        gender: updatedUser.gender,
      }
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sendPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, purpose } = req.body;
    if (!phone) {
      res.status(400).json({ message: 'Phone number is required' });
      return;
    }

    const otpPurpose = purpose || 'LOGIN';
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.otpVerification.create({
      data: {
        identifier: phone,
        otpCode,
        purpose: otpPurpose,
        expiresAt,
      }
    });

    console.log('\n=============================================');
    console.log(`[DEV MODE] Phone OTP Sent to: ${phone}`);
    console.log(`OTP Code: ${otpCode}`);
    console.log(`Purpose: ${otpPurpose}`);
    console.log('=============================================\n');

    res.json({ message: 'OTP sent successfully. Check server console in development mode.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyPhoneOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otpCode, purpose, fullName } = req.body;
    if (!phone || !otpCode) {
      res.status(400).json({ message: 'Phone number and OTP code are required' });
      return;
    }

    const otpPurpose = purpose || 'LOGIN';

    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        identifier: phone,
        otpCode,
        purpose: otpPurpose,
        expiresAt: { gt: new Date() },
        isVerified: false
      }
    });

    if (!otpRecord) {
      res.status(400).json({ message: 'Invalid or expired OTP code' });
      return;
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true }
    });

    let user = await prisma.user.findUnique({
      where: { phone },
      include: { profiles: true }
    });

    if (otpPurpose === 'SIGNUP' || !user) {
      if (!user) {
        const resolvedName = fullName || 'User ' + phone.slice(-4);
        user = await prisma.user.create({
          data: {
            fullName: resolvedName,
            phone,
            isPhoneVerified: true,
            profiles: {
              create: {
                relation: 'SELF',
                fullName: resolvedName,
              }
            },
            notificationPref: {
              create: {}
            }
          },
          include: { profiles: true }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isPhoneVerified: true },
          include: { profiles: true }
        });
      }
    } else {
      if (!user.isPhoneVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isPhoneVerified: true },
          include: { profiles: true }
        });
      }
    }

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.json({
      _id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      isPhoneVerified: user.isPhoneVerified,
      token: generateToken(user.id),
      refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const socialLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, provider, email, fullName, photoUrl } = req.body;

    if (!email) {
      res.status(400).json({ message: 'Email is required for social login' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { email },
      include: { profiles: true }
    });

    if (!user) {
      const resolvedName = fullName || email.split('@')[0];
      user = await prisma.user.create({
        data: {
          fullName: resolvedName,
          email,
          photoUrl,
          isEmailVerified: true,
          profiles: {
            create: {
              relation: 'SELF',
              fullName: resolvedName,
              photoUrl,
            }
          },
          notificationPref: {
            create: {}
          }
        },
        include: { profiles: true }
      });
    } else {
      if (!user.photoUrl && photoUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { photoUrl, isEmailVerified: true },
          include: { profiles: true }
        });
      }
    }

    const refreshToken = generateRefreshToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    res.json({
      _id: user.id,
      fullName: user.fullName,
      email: user.email,
      photoUrl: user.photoUrl,
      isEmailVerified: user.isEmailVerified,
      token: generateToken(user.id),
      refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await prisma.user.delete({
      where: { id: user.id }
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Please provide current and new passwords' });
      return;
    }

    const userDb = await prisma.user.findUnique({ where: { id: user.id } });
    if (!userDb || !userDb.passwordHash) {
      res.status(400).json({ message: 'Password change not supported for this account' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, userDb.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Incorrect current password' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const profiles = await prisma.profile.findMany({
      where: { ownerId: user.id },
      orderBy: { relation: 'asc' }
    });

    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { fullName, relation, dob, gender, photoUrl } = req.body;
    if (!fullName || !relation) {
      res.status(400).json({ message: 'Full name and relation are required' });
      return;
    }

    const newProfile = await prisma.profile.create({
      data: {
        ownerId: user.id,
        fullName,
        relation,
        dob: dob ? new Date(dob) : null,
        gender,
        photoUrl,
      }
    });

    res.status(201).json(newProfile);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfileMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { id } = req.params as { id: string };
    const { fullName, relation, dob, gender, photoUrl } = req.body;

    const profile = await prisma.profile.findFirst({
      where: { id, ownerId: user.id }
    });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found or access denied' });
      return;
    }

    const updatedRelation = profile.relation === 'SELF' ? 'SELF' : relation;

    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: {
        fullName: fullName !== undefined ? fullName : profile.fullName,
        relation: updatedRelation !== undefined ? updatedRelation : profile.relation,
        dob: dob !== undefined ? (dob ? new Date(dob) : null) : profile.dob,
        gender: gender !== undefined ? gender : profile.gender,
        photoUrl: photoUrl !== undefined ? photoUrl : profile.photoUrl,
      }
    });

    if (profile.relation === 'SELF') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: updatedProfile.fullName,
          photoUrl: updatedProfile.photoUrl,
          dob: updatedProfile.dob,
          gender: updatedProfile.gender,
        }
      });
    }

    res.json(updatedProfile);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { id } = req.params as { id: string };

    const profile = await prisma.profile.findFirst({
      where: { id, ownerId: user.id }
    });

    if (!profile) {
      res.status(404).json({ message: 'Profile not found or access denied' });
      return;
    }

    if (profile.relation === 'SELF') {
      res.status(400).json({ message: 'Cannot delete the primary self profile' });
      return;
    }

    await prisma.profile.delete({
      where: { id }
    });

    res.json({ message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
