/**
 * Authentication Routes for Unified Dashboard
 * Handles login, logout, registration, password reset, OAuth, API keys.
 *
 * Assembled from split route modules for maintainability.
 */

import { Hono } from 'hono';
import type { Env } from './types';
import loginRoutes from './login-routes';
import registerRoutes from './register-routes';
import apiKeyRoutes from './api-key-routes';
import googleOAuthRoutes from './oauth-google';
import githubOAuthRoutes from './oauth-github';
import emailVerificationRoutes from './email-verification-routes';
import passwordResetRoutes from './password-reset-routes';

const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.route('/', loginRoutes);
authRoutes.route('/', registerRoutes);
authRoutes.route('/', apiKeyRoutes);
authRoutes.route('/', googleOAuthRoutes);
authRoutes.route('/', githubOAuthRoutes);
authRoutes.route('/', emailVerificationRoutes);
authRoutes.route('/', passwordResetRoutes);

export default authRoutes;
