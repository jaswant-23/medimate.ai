import nodemailer from 'nodemailer';

// Create a reusable transporter using default SMTP transport
// or actual SMTP settings from environment variables if provided.
export const getTransporter = () => {
  if (!process.env.SMTP_USER) {
    return null;
  }
  
  const port = parseInt(process.env.SMTP_PORT || '587');
  const defaultHost = process.env.SMTP_USER.endsWith('@gmail.com') ? 'smtp.gmail.com' : 'smtp.ethereal.email';
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || defaultHost,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const transporter = getTransporter();
  
  // Use frontend URL if available, else fallback
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

  const fromEmail = process.env.SMTP_USER || 'noreply@medimate.local';

  if (!transporter) {
    console.log('\n=============================================');
    console.log('[DEV MODE] Verification Email Intercepted');
    console.log(`To: ${email}`);
    console.log(`Link: ${verificationLink}`);
    console.log('=============================================\n');
    return;
  }

  const mailOptions = {
    from: `"MediMate" <${fromEmail}>`,
    to: email,
    subject: 'Verify your email address',
    text: `Please verify your email by clicking the following link: ${verificationLink}`,
    html: `<p>Please verify your email by clicking the following link:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const transporter = getTransporter();
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  
  const fromEmail = process.env.SMTP_USER || 'noreply@medimate.local';

  if (!transporter) {
    console.log('\n=============================================');
    console.log('[DEV MODE] Password Reset Email Intercepted');
    console.log(`To: ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log('=============================================\n');
    return;
  }

  const mailOptions = {
    from: `"MediMate" <${fromEmail}>`,
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the following link to reset your password: ${resetLink}`,
    html: `<p>You requested a password reset. Click the following link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

export const sendDailyDigestEmail = async (email: string, reminders: any[]) => {
  const transporter = getTransporter();
  
  const fromEmail = process.env.SMTP_USER || 'noreply@medimate.local';
  const subject = `MediMate Daily Summary: Your Reminders for Today`;
  
  let listHtml = '';
  reminders.forEach((r) => {
    const foodInst = r.instruction === 'BEFORE_FOOD' 
      ? 'Before food' 
      : r.instruction === 'AFTER_FOOD' 
        ? 'After food' 
        : r.instruction === 'EMPTY_STOMACH' 
          ? 'Empty stomach' 
          : 'No specific food instructions';

    listHtml += `
      <div style="background: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 15px; margin-bottom: 12px;">
        <div style="font-weight: bold; color: #2d3748; font-size: 16px;">${r.medicine.name} (${r.medicine.type})</div>
        <div style="color: #4a5568; font-size: 14px; margin-top: 4px;">For profile: <strong>${r.profile.fullName}</strong></div>
        <div style="color: #718096; font-size: 13px; margin-top: 4px;">Dosage: ${r.doseAmount} ${r.doseUnit} • ${foodInst}</div>
        <div style="color: #3182ce; font-size: 13px; font-weight: bold; margin-top: 6px;">Times: ${r.times.join(', ')}</div>
      </div>
    `;
  });

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2b6cb0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Your Daily Medicine Digest</h2>
      <p>Here are the scheduled dose reminders for today:</p>
      <div style="margin-top: 20px;">
        ${listHtml}
      </div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 11px; color: #888;">This is an automated notification from MediMate. You can manage your daily digest preferences in settings.</p>
    </div>
  `;

  if (!transporter) {
    console.log('\n=============================================');
    console.log('[DEV MODE] Daily Digest Email Intercepted');
    console.log(`To: ${email}`);
    console.log(`Summary: Sent digest with ${reminders.length} reminder(s)`);
    console.log('=============================================\n');
    return;
  }

  const mailOptions = {
    from: `"MediMate" <${fromEmail}>`,
    to: email,
    subject,
    text: `Daily summary of your medicine intake reminders: ${reminders.map(r => r.medicine.name).join(', ')}`,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Daily digest email sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending daily digest email:', error);
  }
};
