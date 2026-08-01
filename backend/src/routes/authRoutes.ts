import express from 'express';
import { 
  registerUser, 
  loginUser, 
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  refreshToken,
  getUserProfile,
  updateUserSettings,
  sendPhoneOtp,
  verifyPhoneOtp,
  socialLogin,
  deleteAccount,
  changePassword,
  getUserProfiles,
  createProfile,
  updateProfileMember,
  deleteProfile
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/upload';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser); // Alternatively this could be protected
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/refresh-token', refreshToken);
router.post('/phone/send-otp', sendPhoneOtp);
router.post('/phone/verify-otp', verifyPhoneOtp);
router.post('/social', socialLogin);

// Protected routes
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserSettings);

router.post('/change-password', protect, changePassword);

router.route('/profiles')
  .get(protect, getUserProfiles)
  .post(protect, createProfile);

router.route('/profiles/:id')
  .put(protect, updateProfileMember)
  .delete(protect, deleteProfile);

router.delete('/account', protect, deleteAccount);

router.post('/profile/upload', protect, upload.single('image'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const filePath = `/uploads/${req.file.filename}`;
  res.json({ photo: filePath });
});

export default router;
