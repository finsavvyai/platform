import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile
} from '../controllers/authController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateUser, logout);
router.post('/refresh', refreshToken);
router.get('/verify/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', authenticateUser, getProfile);
router.put('/profile', authenticateUser, updateProfile);

export default router;