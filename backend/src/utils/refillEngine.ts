export const checkAndUpdateRefillAlerts = async (
  medicineId: string,
  prisma: any
): Promise<void> => {
  try {
    const medicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
      include: {
        reminders: {
          where: { isActive: true }
        }
      }
    });

    if (!medicine) return;

    // Calculate daily dosage rate
    let dailyDosageRate = 0;
    medicine.reminders.forEach((r: any) => {
      const timesCount = r.times ? r.times.length : 0;
      let multiplier = 1;
      if (r.repeatType === 'WEEKLY') {
        multiplier = (r.daysOfWeek ? r.daysOfWeek.length : 0) / 7;
      } else if (r.repeatType === 'CUSTOM_INTERVAL') {
        multiplier = 1 / (r.intervalDays || 1);
      }
      dailyDosageRate += r.doseAmount * timesCount * multiplier;
    });

    if (dailyDosageRate <= 0) {
      // No active reminders, so no refill alert is needed
      return;
    }

    const daysRemaining = medicine.quantityAvailable / dailyDosageRate;

    // Default thresholds: 7 days, 3 days, 1 day
    const THRESHOLDS = [7, 3, 1];

    for (const threshold of THRESHOLDS) {
      if (daysRemaining <= threshold) {
        // Check if an alert for this medicine at this threshold already exists
        const existingAlert = await prisma.refillAlert.findFirst({
          where: {
            medicineId,
            daysRemainingAtAlert: threshold
          }
        });

        if (!existingAlert) {
          await prisma.refillAlert.create({
            data: {
              medicineId,
              daysRemainingAtAlert: threshold,
              status: 'PENDING'
            }
          });
          console.log(`Refill alert created for medicine "${medicine.name}" (${medicineId}) at threshold ${threshold} days remaining.`);
        }
      } else {
        // If stock is sufficient (above threshold), delete any PENDING/SNOOZED alerts for this threshold
        // (This handles restock automatically!)
        await prisma.refillAlert.deleteMany({
          where: {
            medicineId,
            daysRemainingAtAlert: threshold,
            status: {
              in: ['PENDING', 'SNOOZED']
            }
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error in checkAndUpdateRefillAlerts for medicine ${medicineId}:`, error);
  }
};
