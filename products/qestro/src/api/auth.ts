/**
 * Authentication API Routes
 * Handles user authentication, token management, and authorization
 */

import { JWTAuthService, AuthResponse } from "../services/auth-service";

export interface AuthRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  companyName?: string;
}

/**
 * Authentication API Handler
 */
export class AuthAPI {
  private authService: JWTAuthService;

  constructor(env: any) {
    this.authService = new JWTAuthService(env);
  }

  /**
   * User login endpoint
   */
  async login(request: Request, env: any): Promise<Response> {
    try {
      const body: AuthRequest = await request.json();

      if (!body.email || !body.password) {
        return this.errorResponse("Email and password are required", 400);
      }

      const result: AuthResponse = await this.authService.authenticateUser(
        body.email,
        body.password,
      );

      if (!result.success) {
        return this.errorResponse(result.error || "Authentication failed", 401);
      }

      // Store refresh token in KV for long-term storage
      if (result.tokens) {
        await env.SESSIONS.put(
          `refresh:${result.user!.id}`,
          result.tokens.refreshToken,
          { expirationTtl: 7 * 24 * 60 * 60 }, // 7 days
        );
      }

      return this.jsonResponse(
        {
          success: true,
          user: result.user,
          tokens: result.tokens,
        },
        200,
      );
    } catch (error) {
      console.error("Login error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * User registration endpoint
   */
  async register(request: Request, env: any): Promise<Response> {
    try {
      const body: RegisterRequest = await request.json();

      if (!body.email || !body.password) {
        return this.errorResponse("Email and password are required", 400);
      }

      if (body.password.length < 6) {
        return this.errorResponse(
          "Password must be at least 6 characters",
          400,
        );
      }

      // Check if user already exists (mock implementation)
      // In production, check database for existing email

      // Create new user (mock implementation)
      const newUser = {
        id: crypto.randomUUID(),
        email: body.email.toLowerCase(),
        name: body.name || body.email.split("@")[0],
        role: "user",
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "free",
          status: "active",
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024, // 1GB
            bandwidth: 10 * 1024 * 1024 * 1024, // 10GB
          },
        },
      };

      const tokens = await this.authService.generateTokens(newUser);

      // Store refresh token
      await env.SESSIONS.put(`refresh:${newUser.id}`, tokens.refreshToken, {
        expirationTtl: 7 * 24 * 60 * 60,
      });

      return this.jsonResponse(
        {
          success: true,
          user: newUser,
          tokens: tokens,
        },
        201,
      );
    } catch (error) {
      console.error("Registration error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Refresh access token endpoint
   */
  async refreshToken(request: Request, env: any): Promise<Response> {
    try {
      const body: RefreshTokenRequest = await request.json();

      if (!body.refreshToken) {
        return this.errorResponse("Refresh token is required", 400);
      }

      const result: AuthResponse = await this.authService.refreshAccessToken(
        body.refreshToken,
      );

      if (!result.success) {
        return this.errorResponse(result.error || "Token refresh failed", 401);
      }

      // Update stored refresh token
      if (result.tokens && result.user) {
        await env.SESSIONS.put(
          `refresh:${result.user.id}`,
          result.tokens.refreshToken,
          { expirationTtl: 7 * 24 * 60 * 60 },
        );
      }

      return this.jsonResponse(
        {
          success: true,
          user: result.user,
          tokens: result.tokens,
        },
        200,
      );
    } catch (error) {
      console.error("Token refresh error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * User logout endpoint
   */
  async logout(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await this.authService.authenticate(request);

      if (authResult.error) {
        return this.errorResponse(authResult.error, 401);
      }

      // Remove refresh token from KV
      await env.SESSIONS.delete(`refresh:${authResult.user.userId}`);

      return this.jsonResponse(
        {
          success: true,
          message: "Logged out successfully",
        },
        200,
      );
    } catch (error) {
      console.error("Logout error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await this.authService.authenticate(request);

      if (authResult.error) {
        return this.errorResponse(authResult.error, 401);
      }

      // Get user from database (mock implementation)
      const user = {
        id: authResult.user.userId,
        email: authResult.user.email,
        name: authResult.user.email.split("@")[0],
        role: authResult.user.role,
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "free",
          status: "active",
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024,
            bandwidth: 10 * 1024 * 1024 * 1024,
          },
        },
      };

      return this.jsonResponse(
        {
          success: true,
          user: user,
        },
        200,
      );
    } catch (error) {
      console.error("Get profile error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await this.authService.authenticate(request);

      if (authResult.error) {
        return this.errorResponse(authResult.error, 401);
      }

      const updates = await request.json();

      // Validate updates
      const allowedFields = ["name", "preferences", "avatar"];
      const invalidFields = Object.keys(updates).filter(
        (key) => !allowedFields.includes(key),
      );

      if (invalidFields.length > 0) {
        return this.errorResponse(
          `Invalid fields: ${invalidFields.join(", ")}`,
          400,
        );
      }

      // Update user in database (mock implementation)
      const updatedUser = {
        id: authResult.user.userId,
        email: authResult.user.email,
        name: updates.name || authResult.user.email.split("@")[0],
        role: authResult.user.role,
        preferences: updates.preferences || {},
        avatar: updates.avatar,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "free",
          status: "active",
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024,
            bandwidth: 10 * 1024 * 1024 * 1024,
          },
        },
      };

      return this.jsonResponse(
        {
          success: true,
          user: updatedUser,
        },
        200,
      );
    } catch (error) {
      console.error("Update profile error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Password reset request
   */
  async requestPasswordReset(request: Request, env: any): Promise<Response> {
    try {
      const body: PasswordResetRequest = await request.json();

      if (!body.email) {
        return this.errorResponse("Email is required", 400);
      }

      const resetToken = await this.authService.createPasswordResetToken(
        body.email,
      );

      // Store reset token in KV with 1-hour expiration
      await env.SESSIONS.put(`reset:${body.email.toLowerCase()}`, resetToken, {
        expirationTtl: 60 * 60,
      });

      // In production, send email with reset link
      console.log(`Password reset token for ${body.email}: ${resetToken}`);

      return this.jsonResponse(
        {
          success: true,
          message: "Password reset instructions sent to your email",
        },
        200,
      );
    } catch (error) {
      console.error("Password reset request error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(request: Request, env: any): Promise<Response> {
    try {
      const body: PasswordResetConfirmRequest = await request.json();

      if (!body.token || !body.newPassword) {
        return this.errorResponse("Token and new password are required", 400);
      }

      if (body.newPassword.length < 6) {
        return this.errorResponse(
          "Password must be at least 6 characters",
          400,
        );
      }

      const resetData = await this.authService.verifyPasswordResetToken(
        body.token,
      );

      if (!resetData) {
        return this.errorResponse("Invalid or expired reset token", 400);
      }

      // Verify token matches stored token
      const storedToken = await env.SESSIONS.get(`reset:${resetData.email}`);
      if (storedToken !== body.token) {
        return this.errorResponse("Invalid reset token", 400);
      }

      // Update password in database (mock implementation)
      // In production, hash password and update database

      // Remove reset token
      await env.SESSIONS.delete(`reset:${resetData.email}`);

      return this.jsonResponse(
        {
          success: true,
          message: "Password reset successfully",
        },
        200,
      );
    } catch (error) {
      console.error("Password reset confirm error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Change password
   */
  async changePassword(request: Request, env: any): Promise<Response> {
    try {
      const authResult = await this.authService.authenticate(request);

      if (authResult.error) {
        return this.errorResponse(authResult.error, 401);
      }

      const { currentPassword, newPassword } = await request.json();

      if (!currentPassword || !newPassword) {
        return this.errorResponse(
          "Current password and new password are required",
          400,
        );
      }

      if (newPassword.length < 6) {
        return this.errorResponse(
          "Password must be at least 6 characters",
          400,
        );
      }

      // Verify current password (mock implementation)
      // In production, verify against hashed password in database

      // Update password in database (mock implementation)
      // In production, hash new password and update database

      // Remove all refresh tokens to force re-login on other devices
      await env.SESSIONS.delete(`refresh:${authResult.user.userId}`);

      return this.jsonResponse(
        {
          success: true,
          message: "Password changed successfully",
        },
        200,
      );
    } catch (error) {
      console.error("Change password error:", error);
      return this.errorResponse("Internal server error", 500);
    }
  }

  /**
   * Authentication middleware for protected routes
   */
  async requireAuth(
    request: Request,
    requiredRoles?: string[],
  ): Promise<{
    user: any;
    response?: Response;
  }> {
    const authResult = await this.authService.authenticate(request);

    if (authResult.error) {
      return {
        user: null,
        response: this.errorResponse(authResult.error, 401),
      };
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = this.authService.hasRequiredRole(
        authResult.user,
        requiredRoles,
      );
      if (!hasRole) {
        return {
          user: null,
          response: this.errorResponse("Insufficient permissions", 403),
        };
      }
    }

    // Get full user profile (mock implementation)
    const user = {
      id: authResult.user.userId,
      email: authResult.user.email,
      name: authResult.user.email.split("@")[0],
      role: authResult.user.role,
      preferences: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { user };
  }

  /**
   * Utility method to create JSON responses
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  /**
   * Utility method to create error responses
   */
  private errorResponse(message: string, status: number = 400): Response {
    return this.jsonResponse(
      {
        success: false,
        error: message,
      },
      status,
    );
  }
}

export default AuthAPI;
