import type { Medicine } from '../store/useMedicineStore';
import type { Reminder } from '../store/useReminderStore';

export interface StockStatusInfo {
  status: 'green' | 'yellow' | 'orange' | 'red';
  daysRemaining: number;
  dosesLeft: number;
  dailyRate: number;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const calculateStockStatus = (medicine: Medicine, reminders: Reminder[]): StockStatusInfo => {
  const activeReminders = (reminders || []).filter(
    (r) => r.medicineId === medicine.id && r.isActive !== false
  );

  let dailyRate = 0;
  let maxDoseAmount = 0;

  activeReminders.forEach((r) => {
    const timesPerDay = r.times?.length || 0;
    let multiplier = 1;
    if (r.repeatType === 'WEEKLY') {
      multiplier = (r.daysOfWeek?.length || 0) / 7;
    } else if (r.repeatType === 'CUSTOM_INTERVAL') {
      multiplier = 1 / (r.intervalDays || 1);
    }
    dailyRate += r.doseAmount * timesPerDay * multiplier;
    if (r.doseAmount > maxDoseAmount) {
      maxDoseAmount = r.doseAmount;
    }
  });

  // If no reminders, fallback to dose size of 1
  const doseSize = maxDoseAmount > 0 ? maxDoseAmount : 1;
  const dosesLeft = medicine.quantityAvailable / doseSize;
  const daysRemaining = dailyRate > 0 ? medicine.quantityAvailable / dailyRate : Infinity;

  let status: 'green' | 'yellow' | 'orange' | 'red' = 'green';
  let label = 'Stock Healthy';
  let colorClass = 'text-green-600 dark:text-green-400';
  let bgClass = 'bg-green-500/10';
  let borderClass = 'border-green-500/20';

  // Red: only 2 or fewer doses left
  if (dosesLeft <= 2) {
    status = 'red';
    label = 'Critically Low (≤ 2 doses)';
    colorClass = 'text-rose-600 dark:text-rose-400 font-bold';
    bgClass = 'bg-rose-500/10';
    borderClass = 'border-rose-500/20';
  }
  // Orange: stock will last < 5 days
  else if (daysRemaining < 5) {
    status = 'orange';
    label = `Low Stock (< 5 days)`;
    colorClass = 'text-orange-600 dark:text-orange-400 font-semibold';
    bgClass = 'bg-orange-500/10';
    borderClass = 'border-orange-500/20';
  }
  // Yellow: stock will last < 10 days
  else if (daysRemaining < 10) {
    status = 'yellow';
    label = `Refill Soon (< 10 days)`;
    colorClass = 'text-amber-600 dark:text-amber-400 font-medium';
    bgClass = 'bg-amber-500/10';
    borderClass = 'border-amber-500/20';
  }
  // Green: stock sufficient for current dosage rate for > 10 days
  else {
    status = 'green';
    label = dailyRate > 0 
      ? `Stock Healthy (~${Math.round(daysRemaining)} days)` 
      : 'Stock Healthy';
    colorClass = 'text-green-600 dark:text-green-400';
    bgClass = 'bg-green-500/10';
    borderClass = 'border-green-500/20';
  }

  return {
    status,
    daysRemaining,
    dosesLeft,
    dailyRate,
    label,
    colorClass,
    bgClass,
    borderClass,
  };
};
