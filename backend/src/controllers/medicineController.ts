import { Request, Response } from 'express';
import { PrismaClient, MedicineStatus, MedicineType, StockChangeReason } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuthRequest } from '../middleware/authMiddleware';
import { checkAndUpdateExpiry } from '../utils/expiryEngine';
import { checkAndUpdateRefillAlerts } from '../utils/refillEngine';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Helper to determine medicine status based on expiry date
const calculateMedicineStatus = (expiryDate: Date, expiringSoonDays: number = 30): MedicineStatus => {
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'EXPIRED';
  } else if (diffDays <= expiringSoonDays) {
    return 'EXPIRING_SOON';
  } else {
    return 'SAFE';
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { type, amount, reason } = req.body;

    if (!type || amount === undefined || !reason) {
      res.status(400).json({ message: 'Type, amount, and reason are required' });
      return;
    }

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!medicine) {
      res.status(404).json({ message: 'Medicine not found' });
      return;
    }

    if (medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this medicine' });
      return;
    }

    const numericAmount = parseFloat(amount);
    let changeAmount = 0;
    let newQty = medicine.quantityAvailable;

    if (type === 'correct') {
      changeAmount = numericAmount - medicine.quantityAvailable;
      newQty = Math.max(0, numericAmount);
    } else if (type === 'add') {
      changeAmount = numericAmount;
      newQty = Math.max(0, medicine.quantityAvailable + numericAmount);
    } else {
      res.status(400).json({ message: 'Invalid adjustment type. Must be correct or add.' });
      return;
    }

    const updated = await prisma.medicine.update({
      where: { id },
      data: { quantityAvailable: newQty }
    });

    await prisma.stockHistory.create({
      data: {
        medicineId: id,
        changeAmount,
        reason: reason as StockChangeReason,
        balanceAfter: newQty
      }
    });

    const processed = await checkAndUpdateExpiry(updated, req.user.email, req.user.notificationPref, prisma);
    await checkAndUpdateRefillAlerts(id, prisma);
    
    // Fetch updated medicine including stock history
    const finalMedicine = await prisma.medicine.findUnique({
      where: { id },
      include: {
        profile: true,
        stockHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    res.json(finalMedicine);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      profileId,
      name,
      brandName,
      genericName,
      type,
      dosageAmount,
      dosageUnit,
      quantityAvailable,
      quantityUnit,
      purchaseDate,
      expiryDate,
      batchNumber,
      doctorName,
      prescriptionImageUrl,
      storageInstructions,
      notes
    } = req.body;

    if (!profileId || !name || !type || !dosageAmount || !dosageUnit || !quantityAvailable || !quantityUnit || !expiryDate) {
      res.status(400).json({ message: 'Please provide all required fields' });
      return;
    }

    // Verify profile ownership
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    const expiry = new Date(expiryDate);
    const purchase = purchaseDate ? new Date(purchaseDate) : null;
    const userThreshold = req.user.notificationPref?.expiryThreshold ?? 30;
    const status = calculateMedicineStatus(expiry, userThreshold);

    const medicine = await prisma.medicine.create({
      data: {
        profileId,
        name,
        brandName: brandName || null,
        genericName: genericName || null,
        type: type as MedicineType,
        dosageAmount: parseFloat(dosageAmount),
        dosageUnit,
        quantityAvailable: parseFloat(quantityAvailable),
        quantityUnit,
        purchaseDate: purchase,
        expiryDate: expiry,
        batchNumber: batchNumber || null,
        doctorName: doctorName || null,
        prescriptionImageUrl: prescriptionImageUrl || null,
        storageInstructions: storageInstructions || null,
        notes: notes || null,
        status
      }
    });

    const processedMedicine = await checkAndUpdateExpiry(medicine, req.user.email, req.user.notificationPref, prisma);
    await checkAndUpdateRefillAlerts(medicine.id, prisma);
    res.status(201).json(processedMedicine);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      name,
      brandName,
      genericName,
      type,
      dosageAmount,
      dosageUnit,
      quantityAvailable,
      quantityUnit,
      purchaseDate,
      expiryDate,
      batchNumber,
      doctorName,
      prescriptionImageUrl,
      storageInstructions,
      notes
    } = req.body;

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!medicine) {
      res.status(404).json({ message: 'Medicine not found' });
      return;
    }

    // Verify ownership
    if (medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this medicine' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (brandName !== undefined) updateData.brandName = brandName || null;
    if (genericName !== undefined) updateData.genericName = genericName || null;
    if (type !== undefined) updateData.type = type as MedicineType;
    if (dosageAmount !== undefined) updateData.dosageAmount = parseFloat(dosageAmount);
    if (dosageUnit !== undefined) updateData.dosageUnit = dosageUnit;
    if (quantityAvailable !== undefined) updateData.quantityAvailable = parseFloat(quantityAvailable);
    if (quantityUnit !== undefined) updateData.quantityUnit = quantityUnit;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    
    if (expiryDate !== undefined) {
      const expiry = new Date(expiryDate);
      updateData.expiryDate = expiry;
      const userThreshold = req.user.notificationPref?.expiryThreshold ?? 30;
      updateData.status = calculateMedicineStatus(expiry, userThreshold);
    }

    if (batchNumber !== undefined) updateData.batchNumber = batchNumber || null;
    if (doctorName !== undefined) updateData.doctorName = doctorName || null;
    if (prescriptionImageUrl !== undefined) updateData.prescriptionImageUrl = prescriptionImageUrl || null;
    if (storageInstructions !== undefined) updateData.storageInstructions = storageInstructions || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const updatedMedicine = await prisma.medicine.update({
      where: { id },
      data: updateData
    });

    const processedMedicine = await checkAndUpdateExpiry(updatedMedicine, req.user.email, req.user.notificationPref, prisma);
    await checkAndUpdateRefillAlerts(id, prisma);
    res.json(processedMedicine);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!medicine) {
      res.status(404).json({ message: 'Medicine not found' });
      return;
    }

    if (medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this medicine' });
      return;
    }

    await prisma.medicine.delete({ where: { id } });
    res.json({ message: 'Medicine deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMedicineById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { 
        profile: true,
        stockHistory: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!medicine) {
      res.status(404).json({ message: 'Medicine not found' });
      return;
    }

    if (medicine.profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    const processed = await checkAndUpdateExpiry(medicine, req.user.email, req.user.notificationPref, prisma);
    res.json(processed);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMedicinesByProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profileId = req.params.profileId as string;
    const { search, type, status, sortBy, order } = req.query;

    // Verify profile ownership
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.ownerId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not own this profile' });
      return;
    }

    // Build filter queries
    const whereClause: any = { profileId };

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { brandName: { contains: search as string, mode: 'insensitive' } },
        { genericName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (type) {
      whereClause.type = type as MedicineType;
    }

    if (status) {
      whereClause.status = status as MedicineStatus;
    }

    // Sorting parameters
    const sortField = sortBy ? (sortBy as string) : 'expiryDate';
    const sortOrder = order ? (order as string) : 'asc';

    const medicines = await prisma.medicine.findMany({
      where: whereClause,
      orderBy: {
        [sortField]: sortOrder
      }
    });

    const processedMedicines = await Promise.all(
      medicines.map((med) => checkAndUpdateExpiry(med, req.user.email, req.user.notificationPref, prisma))
    );
    res.json(processedMedicines);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
