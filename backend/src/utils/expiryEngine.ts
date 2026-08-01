import { getTransporter } from './email';

const OFFSETS = [90, 60, 30, 15, 7, 3, 1];

export const checkAndUpdateExpiry = async (
  medicine: any,
  userEmail: string,
  userPref: any,
  prisma: any
): Promise<any> => {
  const now = new Date();
  const expiryDate = new Date(medicine.expiryDate);
  
  // Set times to midnight to do date-based math rather than millisecond-based
  expiryDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine threshold
  const threshold = userPref?.expiryThreshold ?? 30;

  // Determine calculated status
  let calculatedStatus: 'SAFE' | 'EXPIRING_SOON' | 'EXPIRED' = 'SAFE';
  if (daysRemaining <= 0) {
    calculatedStatus = 'EXPIRED';
  } else if (daysRemaining <= threshold) {
    calculatedStatus = 'EXPIRING_SOON';
  }

  // Update in database if status changed
  let updatedMedicine = medicine;
  if (medicine.status !== calculatedStatus) {
    updatedMedicine = await prisma.medicine.update({
      where: { id: medicine.id },
      data: { status: calculatedStatus },
      include: { profile: true }
    });
  }

  // If user enabled expiry alerts, process staged notifications
  if (userPref?.expiryAlerts !== false && daysRemaining > 0) {
    // Find matching offset
    // Staged offsets: 90 / 60 / 30 / 15 / 7 / 3 / 1
    const matchingOffset = OFFSETS.find(
      (offset) => daysRemaining <= offset && (!OFFSETS[OFFSETS.indexOf(offset) + 1] || daysRemaining > OFFSETS[OFFSETS.indexOf(offset) + 1])
    );

    if (matchingOffset !== undefined) {
      // Check if notification has already been sent for this offset
      const logged = await prisma.expiryNotificationLog.findUnique({
        where: {
          medicineId_daysBeforeExpiry: {
            medicineId: medicine.id,
            daysBeforeExpiry: matchingOffset
          }
        }
      });

      if (!logged) {
        // Trigger alert email
        await sendExpiryWarningEmail(userEmail, medicine.name, daysRemaining, matchingOffset);
        
        // Log it
        await prisma.expiryNotificationLog.create({
          data: {
            medicineId: medicine.id,
            daysBeforeExpiry: matchingOffset
          }
        });
      }
    }
  }

  return {
    ...updatedMedicine,
    daysRemaining
  };
};

const sendExpiryWarningEmail = async (
  email: string,
  medicineName: string,
  daysRemaining: number,
  offset: number
) => {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_USER || 'noreply@medimate.local';
  const subject = `MediMate Alert: "${medicineName}" expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
  const text = `Hi,\n\nYour medicine "${medicineName}" is expiring in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} (offset: ${offset} day warning).\n\nPlease check your medicine cabinet to take appropriate action.\n\nBest,\nMediMate Team`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #dd6b20;">Medicine Expiry Warning</h2>
      <p>Your medicine <strong>"${medicineName}"</strong> is expiring in <strong>${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong> (on the ${offset}-day staged warning threshold).</p>
      <p>Please check your medicine cabinet to take appropriate action (Donate / Dispose / Remove).</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 11px; color: #888;">This is an automated notification from MediMate. You can adjust your expiry warning preferences in user settings.</p>
    </div>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log('[DEV MODE] Expiry Warning Email Intercepted');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
    console.log('=============================================\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"MediMate" <${fromEmail}>`,
      to: email,
      subject,
      text,
      html
    });
    console.log(`Expiry warning email sent to ${email} for medicine ${medicineName}`);
  } catch (error) {
    console.error('Error sending expiry warning email:', error);
  }
};
