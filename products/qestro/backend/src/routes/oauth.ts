import { Router } from 'express';
import {
  getOAuthUrl,
  handleOAuthCallback,
  getOAuthConnections,
  disconnectOAuth,
  getOAuthProviders
} from '../controllers/oauthController.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/providers', getOAuthProviders);
router.get('/url', getOAuthUrl);
router.post('/callback', handleOAuthCallback);

// Protected routes
router.get('/connections', authenticateUser, getOAuthConnections);
router.delete('/disconnect', authenticateUser, disconnectOAuth);

export default router;
