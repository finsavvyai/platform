import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { users } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../services/EmailService.js';
import { z } from 'zod';
import crypto from 'crypto';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100).optional(),
  role: z.enum(['user', 'admin']).default('user')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: 900 } // 15 minutes in seconds
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
    { expiresIn: 604800 } // 7 days in seconds
  );

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await db.select().from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const [newUser] = await db.insert(users).values({
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
    }).returning();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?userId=${newUser.id}`;
    await sendEmail({
      to: newUser.email,
      subject: 'Welcome to Questro - Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Welcome to Questro! 🚀</h1>
          <p>Hi ${newUser.firstName},</p>
          <p>Thank you for joining Questro, the world's most comprehensive test automation platform.</p>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
          <p>Or copy this link: ${verificationUrl}</p>
          <p>This link expires in 24 hours.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
          <h2>Your Free Plan Includes:</h2>
          <ul>
            <li>100 AI-powered test generations per month</li>
            <li>10 web recording sessions</li>
            <li>5 mobile recording sessions</li>
            <li>50 API tests</li>
            <li>10 performance tests</li>
            <li>2 data source connections</li>
          </ul>
          <p>Ready to unleash the full power of Questro? <a href="${process.env.FRONTEND_URL}/pricing">Upgrade to Pro</a></p>
          <p>Best regards,<br>The Questro Team</p>
        </div>
      `
    });

    const { accessToken, refreshToken } = generateTokens(newUser.id);

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isEmailVerified: false
      },
      tokens: { accessToken, refreshToken }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const [user] = await db.select().from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Please use OAuth login for this account' });
    }

    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please check your email and verify your account first'
      });
    }

    await db.update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        subscription: user.subscription,
        theme: user.theme
      },
      tokens: { accessToken, refreshToken }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.json({ message: 'Email already verified' });
    }

    await db.update(users)
      .set({
        isEmailVerified: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    await sendEmail({
      to: user.email,
      subject: 'Email Verified - Welcome to Questro!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Email Verified Successfully! ✅</h1>
          <p>Hi ${user.firstName},</p>
          <p>Your email has been verified and your Questro account is now fully activated.</p>
          <h2>Get Started with Questro:</h2>
          <ul>
            <li><a href="${process.env.FRONTEND_URL}/recording-studio">Record your first test</a></li>
            <li><a href="${process.env.FRONTEND_URL}/docs/quickstart">Read the quickstart guide</a></li>
            <li><a href="${process.env.FRONTEND_URL}/integrations">Connect your tools</a></li>
          </ul>
          <p>Need help? Our support team is here for you at support@questro.io</p>
          <p>Happy Testing!<br>The Questro Team</p>
        </div>
      `
    });

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!
    ) as any;

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tokens = generateTokens(user.id);

    res.json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // Generate a reset token (in production, store this in a separate table or cache)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&userId=${user.id}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset Your Questro Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">Password Reset Request</h1>
          <p>Hi ${user.firstName},</p>
          <p>We received a request to reset your Questro password.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
          <p>Best regards,<br>The Questro Team</p>
        </div>
      `
    });

    res.json({
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password required' });
    }

    const passwordSchema = z.string().min(8).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    );

    try {
      passwordSchema.parse(password);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid password format' });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">Password Reset Successful ✅</h1>
          <p>Hi ${user.firstName},</p>
          <p>Your Questro password has been successfully reset.</p>
          <p>You can now <a href="${process.env.FRONTEND_URL}/login">log in</a> with your new password.</p>
          <p>If you didn't make this change, please contact our support team immediately at support@questro.io</p>
          <p>Best regards,<br>The Questro Team</p>
        </div>
      `
    });

    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      avatar: users.avatar,
      subscription: users.subscription,
      theme: users.theme,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, lastName, avatar } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updateData: any = { updatedAt: new Date() };

    if (firstName) {
      const nameSchema = z.string().min(2).max(100);
      try {
        nameSchema.parse(firstName);
        updateData.firstName = firstName;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid first name format' });
      }
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName;
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatar: updatedUser.avatar,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};