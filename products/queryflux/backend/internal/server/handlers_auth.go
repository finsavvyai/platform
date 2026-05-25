package server

import (
	"net/http"
	"strings"

	"github.com/queryflux/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// AuthHandlers contains authentication-related HTTP handlers
type AuthHandlers struct {
	authService services.AuthService
	userService services.UserService
}

// NewAuthHandlers creates a new AuthHandlers instance
func NewAuthHandlers(authService services.AuthService, userService services.UserService) *AuthHandlers {
	return &AuthHandlers{
		authService: authService,
		userService: userService,
	}
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Password string `json:"password" binding:"required,min=8"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// ResetPasswordRequest represents a password reset request
type ResetPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ConfirmPasswordResetRequest represents a password reset confirmation request
type ConfirmPasswordResetRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// RefreshTokenRequest represents a token refresh request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// AuthResponse represents an authentication response
type AuthResponse struct {
	User  interface{} `json:"user"`
	Token string      `json:"token"`
}

// Register handles user registration
func (h *AuthHandlers) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	user, token, err := h.authService.Register(c.Request.Context(), req.Email, req.Name, req.Password)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "USER_EXISTS",
				"message": "User with this email already exists",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "REGISTRATION_FAILED",
			"message": "Failed to register user",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		User:  user,
		Token: token,
	})
}

// Login handles user login
func (h *AuthHandlers) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	user, token, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if strings.Contains(err.Error(), "invalid credentials") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_CREDENTIALS",
				"message": "Invalid email or password",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "LOGIN_FAILED",
			"message": "Failed to login",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		User:  user,
		Token: token,
	})
}

// Logout handles user logout
func (h *AuthHandlers) Logout(c *gin.Context) {
	token := extractTokenFromHeader(c)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "MISSING_TOKEN",
			"message": "Authorization token is required",
		})
		return
	}

	if err := h.authService.Logout(c.Request.Context(), token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "LOGOUT_FAILED",
			"message": "Failed to logout",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully logged out",
	})
}

// RefreshToken handles token refresh
func (h *AuthHandlers) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	newToken, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "expired") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_REFRESH_TOKEN",
				"message": "Invalid or expired refresh token",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "REFRESH_FAILED",
			"message": "Failed to refresh token",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": newToken,
	})
}

// ChangePassword handles password change
func (h *AuthHandlers) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "User not authenticated",
		})
		return
	}

	if err := h.authService.ChangePassword(c.Request.Context(), userID.(string), req.OldPassword, req.NewPassword); err != nil {
		if strings.Contains(err.Error(), "invalid old password") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_OLD_PASSWORD",
				"message": "Invalid old password",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "PASSWORD_CHANGE_FAILED",
			"message": "Failed to change password",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password changed successfully",
	})
}

// ResetPassword handles password reset initiation
func (h *AuthHandlers) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	if err := h.authService.ResetPassword(c.Request.Context(), req.Email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "RESET_FAILED",
			"message": "Failed to initiate password reset",
			"details": err.Error(),
		})
		return
	}

	// Always return success for security (don't reveal if email exists)
	c.JSON(http.StatusOK, gin.H{
		"message": "If the email exists, a password reset link has been sent",
	})
}

// ConfirmPasswordReset handles password reset confirmation
func (h *AuthHandlers) ConfirmPasswordReset(c *gin.Context) {
	var req ConfirmPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	if err := h.authService.ConfirmPasswordReset(c.Request.Context(), req.Token, req.NewPassword); err != nil {
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "expired") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_RESET_TOKEN",
				"message": "Invalid or expired reset token",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "RESET_CONFIRMATION_FAILED",
			"message": "Failed to reset password",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password reset successfully",
	})
}

// Me returns the current user's information
func (h *AuthHandlers) Me(c *gin.Context) {
	// Get user from context (set by auth middleware)
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "User not authenticated",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

// UpdateProfile handles user profile updates
func (h *AuthHandlers) UpdateProfile(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required,min=2,max=100"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "UNAUTHORIZED",
			"message": "User not authenticated",
		})
		return
	}

	if err := h.userService.UpdateProfile(c.Request.Context(), userID.(string), req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "UPDATE_FAILED",
			"message": "Failed to update profile",
			"details": err.Error(),
		})
		return
	}

	// Get updated user
	user, err := h.userService.GetByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "USER_FETCH_FAILED",
			"message": "Failed to fetch updated user",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

// extractTokenFromHeader extracts the JWT token from the Authorization header
func extractTokenFromHeader(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return ""
	}

	// Check if it starts with "Bearer "
	if len(authHeader) > 7 && strings.ToLower(authHeader[:7]) == "bearer " {
		return authHeader[7:]
	}

	return ""
}