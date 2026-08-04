import { Request, Response } from 'express';
import Tesseract from 'tesseract.js';
import fs from 'fs';
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

export const extractPrescription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No image uploaded' });
      return;
    }

    const imagePath = req.file.path;
    
    // Run OCR
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    console.log("--- OCR Raw Text ---");
    console.log(text);
    console.log("--------------------");
    
    // Cleanup the uploaded file after OCR
    fs.unlinkSync(imagePath);

    // Basic NLP / Smart Filtering to get potential medicine names
    const lines = text.split('\n').map(line => line.trim());
    const stopWords = ['NAME', 'DATE', 'AGE', 'GENDER', 'MALE', 'FEMALE', 'DIAGNOSIS', 'SYMPTOM', 'TABLET', 'SYRUP', 'CAPSULE', 'DAILY', 'TAKE', 'DAY', 'REFILL', 'DOCTOR', 'PATIENT', 'CLINIC', 'HOSPITAL', 'ADVICE', 'TESTS'];
    
    let rawMedicines: string[] = [];

    // Strategy 1: Look for numbered lists (e.g., "1. Augmentin")
    const numberedRegex = /^\d+[\.\)]\s*([a-zA-Z]{2,})/i;
    lines.forEach(line => {
      const match = line.match(numberedRegex);
      if (match && match[1]) {
        rawMedicines.push(match[1].toUpperCase());
      }
    });

    // Strategy 2: Look for dosage indicators on the line if Strategy 1 found nothing
    if (rawMedicines.length === 0) {
      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.match(/\b(mg|ml|tablet|capsule|syrup|drop)\b/)) {
           const words = line.replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/);
           // Try to grab the first valid word
           for (const word of words) {
             if (word.length > 2 && !stopWords.includes(word.toUpperCase())) {
               rawMedicines.push(word.toUpperCase());
               break; // only take the first valid word of the line
             }
           }
        }
      });
    }

    // Strategy 3: Fallback (Aggressive filtering)
    if (rawMedicines.length === 0) {
      lines.forEach(line => {
        const words = line.replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/);
        words.forEach(word => {
          // In medical prescriptions, medicines are often fully uppercase or capitalized
          if (word.length > 4 && word === word.toUpperCase() && !stopWords.includes(word.toUpperCase())) {
             rawMedicines.push(word.toUpperCase());
          }
        });
      });
    }

    // Deduplicate and format
    const extractedMedicines = [...new Set(rawMedicines)]
      .filter(med => !stopWords.includes(med))
      .map(med => med.charAt(0) + med.slice(1).toLowerCase());

    console.log("Extracted Medicines: ", extractedMedicines);
    res.json({ text, medicines: extractedMedicines });
  } catch (error: any) {
    console.error("OCR Error:", error);
    res.status(500).json({ message: 'Failed to process prescription image', error: error.message });
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
