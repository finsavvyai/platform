package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// authService implements the AuthService interface
type authService struct {
	userRepo         repositories.UserRepository
	sessionRepo      repositories.SessionRepository
	redisClient      *redis.Client
	jwtSecret        string
	jwtExpiration    int // hours
	refreshExpiration int // hours
}

// NewAuthService creates a new auth service
func NewAuthService(userRepo repositories.UserRepository, sessionRepo repositories.SessionRepository, redisClient *redis.Client, jwtSecret string, jwtExpiration int) (AuthService, error) {
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT secret is required")
	}
	if jwtExpiration <= 0 {
		jwtExpiration = 24 // default 24 hours
	}

	refreshExpiration := jwtExpiration * 7 // refresh token lasts 7x longer than access token

	return &authService{
		userRepo:          userRepo,
		sessionRepo:       sessionRepo,
		redisClient:       redisClient,
		jwtSecret:         jwtSecret,
		jwtExpiration:     jwtExpiration,
		refreshExpiration: refreshExpiration,
	}, nil
}

// Register registers a new user
func (s *authService) Register(ctx context.Context, email, name, password string) (*entities.User, string, error) {
	// Validate input
	if email == "" {
		return nil, "", fmt.Errorf("email is required")
	}
	if name == "" {
		return nil, "", fmt.Errorf("name is required")
	}
	if password == "" {
		return nil, "", fmt.Errorf("password is required")
	}
	if len(password) < 8 {
		return nil, "", fmt.Errorf("password must be at least 8 characters long")
	}

	// Check if user already exists
	exists, err := s.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check if user exists: %w", err)
	}
	if exists {
		return nil, "", fmt.Errorf("user with email %s already exists", email)
	}

	// Hash password
	passwordHash, err := s.hashPassword(password)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user entity
	user, err := entities.NewUser(email, name, passwordHash)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create user entity: %w", err)
	}

	// Save user to database
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, "", fmt.Errorf("failed to save user: %w", err)
	}

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	// Generate refresh token
	refreshToken, err := s.generateRefreshToken()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Create session
	expiresAt := time.Now().Add(time.Duration(s.jwtExpiration) * time.Hour)
	refreshExpiresAt := time.Now().Add(time.Duration(s.refreshExpiration) * time.Hour)
	
	session, err := entities.NewSession(user.ID, token, refreshToken, expiresAt, refreshExpiresAt, "", "")
	if err != nil {
		return nil, "", fmt.Errorf("failed to create session: %w", err)
	}

	// Save session to database
	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to save session: %w", err)
	}

	// Store session in Redis
	if err := s.storeSessionInRedis(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to store session in Redis: %w", err)
	}

	return user, token, nil
}

// Login authenticates a user and returns a JWT token
func (s *authService) Login(ctx context.Context, email, password string) (*entities.User, string, error) {
	// Validate input
	if email == "" {
		return nil, "", fmt.Errorf("email is required")
	}
	if password == "" {
		return nil, "", fmt.Errorf("password is required")
	}

	// Get user by email
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, "", fmt.Errorf("invalid credentials")
	}

	// Verify password
	if err := s.verifyPassword(password, user.PasswordHash); err != nil {
		return nil, "", fmt.Errorf("invalid credentials")
	}

	// Update last login
	user.UpdateLastLogin()
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, "", fmt.Errorf("failed to update user: %w", err)
	}

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	// Generate refresh token
	refreshToken, err := s.generateRefreshToken()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Create session
	expiresAt := time.Now().Add(time.Duration(s.jwtExpiration) * time.Hour)
	refreshExpiresAt := time.Now().Add(time.Duration(s.refreshExpiration) * time.Hour)
	
	session, err := entities.NewSession(user.ID, token, refreshToken, expiresAt, refreshExpiresAt, "", "")
	if err != nil {
		return nil, "", fmt.Errorf("failed to create session: %w", err)
	}

	// Save session to database
	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to save session: %w", err)
	}

	// Store session in Redis
	if err := s.storeSessionInRedis(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to store session in Redis: %w", err)
	}

	return user, token, nil
}

// Logout logs out a user by invalidating their token
func (s *authService) Logout(ctx context.Context, token string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}

	// Get session by token
	session, err := s.sessionRepo.GetByToken(ctx, token)
	if err != nil {
		return fmt.Errorf("session not found")
	}

	// Deactivate session
	session.Deactivate()
	if err := s.sessionRepo.Update(ctx, session); err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	// Remove from Redis
	if err := s.removeSessionFromRedis(ctx, token); err != nil {
		return fmt.Errorf("failed to remove session from Redis: %w", err)
	}

	return nil
}

// RefreshToken refreshes a JWT token
func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	if refreshToken == "" {
		return "", fmt.Errorf("refresh token is required")
	}

	// Get session by refresh token
	session, err := s.sessionRepo.GetByRefreshToken(ctx, refreshToken)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token")
	}

	// Check if session is active and not expired
	if !session.IsActive || session.IsRefreshExpired() {
		return "", fmt.Errorf("refresh token expired")
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, session.UserID)
	if err != nil {
		return "", fmt.Errorf("user not found")
	}

	// Generate new tokens
	newToken, err := s.generateToken(user)
	if err != nil {
		return "", fmt.Errorf("failed to generate new token: %w", err)
	}

	newRefreshToken, err := s.generateRefreshToken()
	if err != nil {
		return "", fmt.Errorf("failed to generate new refresh token: %w", err)
	}

	// Update session with new tokens
	expiresAt := time.Now().Add(time.Duration(s.jwtExpiration) * time.Hour)
	refreshExpiresAt := time.Now().Add(time.Duration(s.refreshExpiration) * time.Hour)
	
	if err := session.UpdateTokens(newToken, newRefreshToken, expiresAt, refreshExpiresAt); err != nil {
		return "", fmt.Errorf("failed to update session tokens: %w", err)
	}

	// Save updated session
	if err := s.sessionRepo.Update(ctx, session); err != nil {
		return "", fmt.Errorf("failed to update session: %w", err)
	}

	// Update Redis
	if err := s.storeSessionInRedis(ctx, session); err != nil {
		return "", fmt.Errorf("failed to update session in Redis: %w", err)
	}

	return newToken, nil
}

// ValidateToken validates a JWT token and returns the user
func (s *authService) ValidateToken(ctx context.Context, token string) (*entities.User, error) {
	if token == "" {
		return nil, fmt.Errorf("token is required")
	}

	// Check if session exists in Redis first (fast lookup)
	exists, err := s.sessionExistsInRedis(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("failed to check session in Redis: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	// Parse the token
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if !parsedToken.Valid {
		return nil, fmt.Errorf("token is not valid")
	}

	// Extract claims
	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid user_id in token")
	}

	// Get session from database to verify it's still active
	session, err := s.sessionRepo.GetByToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("session not found in database")
	}

	if !session.IsActive || session.IsExpired() {
		return nil, fmt.Errorf("session expired or inactive")
	}

	// Get user from database
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user, nil
}

// ChangePassword changes a user's password
func (s *authService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	// Validate input
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}
	if oldPassword == "" {
		return fmt.Errorf("old password is required")
	}
	if newPassword == "" {
		return fmt.Errorf("new password is required")
	}
	if len(newPassword) < 8 {
		return fmt.Errorf("new password must be at least 8 characters long")
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Verify old password
	if err := s.verifyPassword(oldPassword, user.PasswordHash); err != nil {
		return fmt.Errorf("invalid old password")
	}

	// Hash new password
	newPasswordHash, err := s.hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update user password
	if err := user.SetPasswordHash(newPasswordHash); err != nil {
		return fmt.Errorf("failed to set password hash: %w", err)
	}

	// Save user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Invalidate all existing sessions for security
	if err := s.sessionRepo.DeleteByUserID(ctx, userID); err != nil {
		return fmt.Errorf("failed to invalidate sessions: %w", err)
	}

	// Remove all sessions from Redis
	if err := s.removeUserSessionsFromRedis(ctx, userID); err != nil {
		return fmt.Errorf("failed to remove sessions from Redis: %w", err)
	}

	return nil
}

// ResetPassword initiates password reset process
func (s *authService) ResetPassword(ctx context.Context, email string) error {
	if email == "" {
		return fmt.Errorf("email is required")
	}

	// Check if user exists
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// Don't reveal if user exists or not for security
		return nil
	}

	// Generate reset token
	resetToken, err := s.generateRefreshToken()
	if err != nil {
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	// Store reset token in Redis with expiration (1 hour)
	resetKey := fmt.Sprintf("password_reset:%s", resetToken)
	if err := s.redisClient.Set(ctx, resetKey, user.ID, time.Hour).Err(); err != nil {
		return fmt.Errorf("failed to store reset token: %w", err)
	}

	// TODO: Send email with reset token (would be implemented in a real application)
	// For now, we just log it or return it somehow
	
	return nil
}

// ConfirmPasswordReset confirms password reset with token
func (s *authService) ConfirmPasswordReset(ctx context.Context, token, newPassword string) error {
	if token == "" {
		return fmt.Errorf("reset token is required")
	}
	if newPassword == "" {
		return fmt.Errorf("new password is required")
	}
	if len(newPassword) < 8 {
		return fmt.Errorf("new password must be at least 8 characters long")
	}

	// Get user ID from Redis
	resetKey := fmt.Sprintf("password_reset:%s", token)
	userID, err := s.redisClient.Get(ctx, resetKey).Result()
	if err != nil {
		return fmt.Errorf("invalid or expired reset token")
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Hash new password
	newPasswordHash, err := s.hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// Update user password
	if err := user.SetPasswordHash(newPasswordHash); err != nil {
		return fmt.Errorf("failed to set password hash: %w", err)
	}

	// Save user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Delete reset token from Redis
	if err := s.redisClient.Del(ctx, resetKey).Err(); err != nil {
		return fmt.Errorf("failed to delete reset token: %w", err)
	}

	// Invalidate all existing sessions for security
	if err := s.sessionRepo.DeleteByUserID(ctx, userID); err != nil {
		return fmt.Errorf("failed to invalidate sessions: %w", err)
	}

	// Remove all sessions from Redis
	if err := s.removeUserSessionsFromRedis(ctx, userID); err != nil {
		return fmt.Errorf("failed to remove sessions from Redis: %w", err)
	}

	return nil
}

// generateToken generates a JWT token for a user
func (s *authService) generateToken(user *entities.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"plan":    user.Plan,
		"exp":     time.Now().Add(time.Duration(s.jwtExpiration) * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// generateRefreshToken generates a secure random refresh token
func (s *authService) generateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashPassword hashes a password using bcrypt
func (s *authService) hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// verifyPassword verifies a password against its hash
func (s *authService) verifyPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// storeSessionInRedis stores a session in Redis
func (s *authService) storeSessionInRedis(ctx context.Context, session *entities.Session) error {
	sessionKey := fmt.Sprintf("session:%s", session.Token)
	sessionData := fmt.Sprintf("%s:%s", session.UserID, session.ID)
	
	// Store with expiration matching the session expiration
	duration := time.Until(session.ExpiresAt)
	if duration <= 0 {
		return fmt.Errorf("session already expired")
	}
	
	return s.redisClient.Set(ctx, sessionKey, sessionData, duration).Err()
}

// sessionExistsInRedis checks if a session exists in Redis
func (s *authService) sessionExistsInRedis(ctx context.Context, token string) (bool, error) {
	sessionKey := fmt.Sprintf("session:%s", token)
	exists, err := s.redisClient.Exists(ctx, sessionKey).Result()
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}

// removeSessionFromRedis removes a session from Redis
func (s *authService) removeSessionFromRedis(ctx context.Context, token string) error {
	sessionKey := fmt.Sprintf("session:%s", token)
	return s.redisClient.Del(ctx, sessionKey).Err()
}

// removeUserSessionsFromRedis removes all sessions for a user from Redis
func (s *authService) removeUserSessionsFromRedis(ctx context.Context, userID string) error {
	// Get all sessions for the user from database
	sessions, err := s.sessionRepo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}

	// Remove each session from Redis
	for _, session := range sessions {
		if err := s.removeSessionFromRedis(ctx, session.Token); err != nil {
			// Log error but continue removing other sessions
			continue
		}
	}

	return nil
}