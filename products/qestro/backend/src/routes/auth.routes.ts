import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../schema/index.js';
import { logger } from '../utils/logger.js';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and number'
  ),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').optional(),
  role: z.enum(['user', 'admin']).default('user')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required')
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  resetToken: z.string(),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
});

// Helper functions
const generateTokens = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const accessToken = jwt.sign(
    { userId, type: 'access' },
    jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    jwtRefreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// POST /register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    // Check if user exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName || '',
        role: validatedData.role,
        isEmailVerified: false,
        authMethod: 'email',
        theme: 'dark',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser.id);

    logger.info(`User registered: ${newUser.email}`);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        subscription: newUser.subscription
      },
      tokens: { accessToken, refreshToken }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        subscription: user.subscription
      },
      tokens: { accessToken, refreshToken }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /logout
authRouter.post('/logout', authenticateUser, (req: Request, res: Response) => {
  // JWT tokens are stateless, so we just acknowledge the logout
  // In production, you'd invalidate the token in Redis/cache
  res.json({ message: 'Logged out successfully' });
});

// POST /refresh
authRouter.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || jwtSecret
    ) as any;

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    res.json({
      tokens: { accessToken, refreshToken: newRefreshToken }
    });

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('Refresh error:', error);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// GET /me
authRouter.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
        role: users.role,
        subscription: users.subscription,
        theme: users.theme,
        isEmailVerified: users.isEmailVerified
      })
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /forgot-password
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      // In production, generate reset token and send email
      logger.info(`Password reset requested for: ${email}`);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If account exists, password reset email sent' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /reset-password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);

    // In production, validate reset token
    // const isTokenValid = verifyResetToken(validatedData.resetToken);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 12);

    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    logger.info(`Password reset for: ${validatedData.email}`);

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});
