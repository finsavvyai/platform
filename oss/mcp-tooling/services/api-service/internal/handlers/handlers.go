package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/middleware"
	"github.com/mcpoverflow/api-service/internal/models"
)

// Helper function to generate JWT tokens
func generateJWT(user models.User, expiry int, secret string) (string, error) {
	claims := middleware.Claims{
		UserID: user.ID.String(),
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiry) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "mcpoverflow-api",
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// Helper function to generate API keys
func generateAPIKey() (string, string, error) {
	// Generate 32-byte random key
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		return "", "", err
	}

	fullKey := "mcp_" + hex.EncodeToString(keyBytes)
	prefix := fullKey[:8] // First 8 characters for display

	return fullKey, prefix, nil
}

// Helper function to parse integer from string
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}

func LoginHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Find user by email
		var user models.User
		if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid credentials",
				"code":  "INVALID_CREDENTIALS",
			})
			return
		}

		// Check if user is active
		if !user.IsActive {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Account is deactivated",
				"code":  "ACCOUNT_DEACTIVATED",
			})
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid credentials",
				"code":  "INVALID_CREDENTIALS",
			})
			return
		}

		// Generate JWT tokens
		accessToken, err := generateJWT(user, cfg.JWT.AccessTokenExpiry, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate access token",
				"code":  "TOKEN_GENERATION_ERROR",
			})
			return
		}

		refreshToken, err := generateJWT(user, cfg.JWT.RefreshTokenExpiry, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate refresh token",
				"code":  "TOKEN_GENERATION_ERROR",
			})
			return
		}

		// Update last login
		now := time.Now()
		db.Model(&user).Update("last_login_at", now)

		// Clear password from response
		user.Password = ""

		c.JSON(http.StatusOK, AuthResponse{
			User:         user,
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ExpiresIn:    cfg.JWT.AccessTokenExpiry,
		})
	}
}

type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	User         models.User `json:"user"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"`
}

func RegisterHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Check if user already exists
		var existingUser models.User
		if err := db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "User with this email already exists",
				"code":  "USER_EXISTS",
			})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to hash password",
				"code":  "PASSWORD_HASH_ERROR",
			})
			return
		}

		// Create user
		user := models.User{
			Email:     req.Email,
			Password:  string(hashedPassword),
			FirstName: req.FirstName,
			LastName:  req.LastName,
			IsActive:  true,
			Role:      models.RoleUser,
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to create user",
				"code":  "USER_CREATION_ERROR",
			})
			return
		}

		// Generate JWT tokens
		accessToken, err := generateJWT(user, cfg.JWT.AccessTokenExpiry, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate access token",
				"code":  "TOKEN_GENERATION_ERROR",
			})
			return
		}

		refreshToken, err := generateJWT(user, cfg.JWT.RefreshTokenExpiry, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate refresh token",
				"code":  "TOKEN_GENERATION_ERROR",
			})
			return
		}

		// Clear password from response
		user.Password = ""

		c.JSON(http.StatusCreated, AuthResponse{
			User:         user,
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ExpiresIn:    cfg.JWT.AccessTokenExpiry,
		})
	}
}

func LogoutHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Logout endpoint"})
	}
}

func MeHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Parse user ID
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid user ID format",
				"code":  "INVALID_USER_ID",
			})
			return
		}

		// Find user with additional stats
		var user models.User
		if err := db.Preload("Connectors").Where("id = ?", userUUID).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "User not found",
				"code":  "USER_NOT_FOUND",
			})
			return
		}

		// Get user statistics
		var connectorCount, agentCount int64
		db.Model(&models.Connector{}).Where("user_id = ?", userUUID).Count(&connectorCount)
		db.Model(&models.Agent{}).Where("connectors.user_id = ?", userUUID).Count(&agentCount)

		// Get API key count
		var apiKeyCount int64
		db.Model(&models.APIKey{}).Where("user_id = ?", userUUID).Count(&apiKeyCount)

		// Clear password from response
		user.Password = ""

		response := gin.H{
			"user": user,
			"stats": gin.H{
				"connectors": connectorCount,
				"agents":     agentCount,
				"api_keys":   apiKeyCount,
			},
		}

		c.JSON(http.StatusOK, response)
	}
}

func GetConnectorsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Get user ID from context
		userID := c.GetString("user_id")
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			// If no user context, this might be an API key request
			apiKeyID := c.GetString("api_key_id")
			if apiKeyID == "" {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "User authentication required",
					"code":  "USER_AUTH_REQUIRED",
				})
				return
			}
			userUUID, err = uuid.Parse(c.GetString("user_id"))
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error": "Invalid user ID format",
					"code":  "INVALID_USER_ID",
				})
				return
			}
		}

		// Parse query parameters
		page := 1
		limit := 20
		status := c.Query("status")
		connectorType := c.Query("type")

		if p := c.Query("page"); p != "" {
			if parsed, err := parseInt(p); err == nil && parsed > 0 {
				page = parsed
			}
		}
		if l := c.Query("limit"); l != "" {
			if parsed, err := parseInt(l); err == nil && parsed > 0 && parsed <= 100 {
				limit = parsed
			}
		}

		// Build query
		query := db.Model(&models.Connector{}).Where("user_id = ?", userUUID)

		if status != "" {
			query = query.Where("status = ?", status)
		}
		if connectorType != "" {
			query = query.Where("type = ?", connectorType)
		}

		// Count total results
		var total int64
		query.Count(&total)

		// Get paginated results
		var connectors []models.Connector
		offset := (page - 1) * limit
		if err := query.Preload("Agents").Offset(offset).Limit(limit).Order("created_at DESC").Find(&connectors).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch connectors",
				"code":  "CONNECTOR_FETCH_ERROR",
			})
			return
		}

		// Build response
		response := gin.H{
			"connectors": connectors,
			"pagination": gin.H{
				"page":  page,
				"limit": limit,
				"total": total,
				"pages": (total + int64(limit) - 1) / int64(limit),
			},
		}

		c.JSON(http.StatusOK, response)
	}
}

func CreateConnectorHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"message": "Connector created"})
	}
}

func GetConnectorHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		c.JSON(http.StatusOK, gin.H{"id": id, "name": "Sample Connector"})
	}
}

func UpdateConnectorHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		c.JSON(http.StatusOK, gin.H{"id": id, "message": "Connector updated"})
	}
}

func DeleteConnectorHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		c.JSON(http.StatusOK, gin.H{"id": id, "message": "Connector deleted"})
	}
}

func DeployConnectorHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		c.JSON(http.StatusOK, gin.H{"id": id, "message": "Connector deployed"})
	}
}

func ParseSpecHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Spec parsed"})
	}
}

func GenerateHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Code generated"})
	}
}

func GetGenerationStatusHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		jobID := c.Param("jobId")
		c.JSON(http.StatusOK, gin.H{"job_id": jobID, "status": "completed"})
	}
}

func GetAgentsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"agents": []string{}})
	}
}

func RegisterAgentHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		connectorID := c.Param("connectorId")
		c.JSON(http.StatusOK, gin.H{"connector_id": connectorID, "message": "Agent registered"})
	}
}

func UnregisterAgentHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("agentId")
		c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "message": "Agent unregistered"})
	}
}

func GetAgentStatusHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		agentID := c.Param("agentId")
		c.JSON(http.StatusOK, gin.H{"agent_id": agentID, "status": "active"})
	}
}

// API Key Management Handlers

type CreateAPIKeyRequest struct {
	Name      string   `json:"name" binding:"required"`
	Scopes    []string `json:"scopes" binding:"required"`
	ExpiresAt *string  `json:"expires_at,omitempty"`
}

type APIKeyResponse struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	KeyPrefix string     `json:"key_prefix"`
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	LastUsed  *time.Time `json:"last_used,omitempty"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	APIKey    string     `json:"api_key"` // Only returned on creation
}

func CreateAPIKeyHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateAPIKeyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Get user ID from context
		userID := c.GetString("user_id")
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid user ID format",
				"code":  "INVALID_USER_ID",
			})
			return
		}

		// Generate API key
		fullKey, prefix, err := generateAPIKey()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate API key",
				"code":  "API_KEY_GENERATION_ERROR",
			})
			return
		}

		// Parse expiry date if provided
		var expiresAt *time.Time
		if req.ExpiresAt != nil {
			if expiryTime, err := time.Parse(time.RFC3339, *req.ExpiresAt); err == nil {
				expiresAt = &expiryTime
			}
		}

		// Create API key record
		apiKey := models.APIKey{
			UserID:    userUUID,
			Name:      req.Name,
			KeyHash:   middleware.HashAPIKey(fullKey),
			KeyPrefix: prefix,
			Scopes:    req.Scopes,
			ExpiresAt: expiresAt,
			IsActive:  true,
		}

		if err := db.Create(&apiKey).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to create API key",
				"code":  "API_KEY_CREATION_ERROR",
			})
			return
		}

		response := APIKeyResponse{
			ID:        apiKey.ID,
			Name:      apiKey.Name,
			KeyPrefix: apiKey.KeyPrefix,
			Scopes:    apiKey.Scopes,
			ExpiresAt: apiKey.ExpiresAt,
			LastUsed:  apiKey.LastUsed,
			IsActive:  apiKey.IsActive,
			CreatedAt: apiKey.CreatedAt,
			APIKey:    fullKey, // Only returned once on creation
		}

		c.JSON(http.StatusCreated, response)
	}
}

func GetAPIKeysHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Get user ID from context
		userID := c.GetString("user_id")
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid user ID format",
				"code":  "INVALID_USER_ID",
			})
			return
		}

		// Get user's API keys
		var apiKeys []models.APIKey
		if err := db.Where("user_id = ?", userUUID).Order("created_at DESC").Find(&apiKeys).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch API keys",
				"code":  "API_KEY_FETCH_ERROR",
			})
			return
		}

		// Convert to response format (without actual keys)
		var responses []APIKeyResponse
		for _, key := range apiKeys {
			responses = append(responses, APIKeyResponse{
				ID:        key.ID,
				Name:      key.Name,
				KeyPrefix: key.KeyPrefix,
				Scopes:    key.Scopes,
				ExpiresAt: key.ExpiresAt,
				LastUsed:  key.LastUsed,
				IsActive:  key.IsActive,
				CreatedAt: key.CreatedAt,
			})
		}

		c.JSON(http.StatusOK, gin.H{"api_keys": responses})
	}
}

func RevokeAPIKeyHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		keyID := c.Param("keyId")

		// Get database from context
		db, exists := c.MustGet("db").(*gorm.DB)
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Database connection not found",
				"code":  "DB_ERROR",
			})
			return
		}

		// Get user ID from context
		userID := c.GetString("user_id")
		userUUID, err := uuid.Parse(userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid user ID format",
				"code":  "INVALID_USER_ID",
			})
			return
		}

		// Parse key ID
		keyUUID, err := uuid.Parse(keyID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid API key ID format",
				"code":  "INVALID_KEY_ID",
			})
			return
		}

		// Find API key and verify ownership
		var apiKey models.APIKey
		if err := db.Where("id = ? AND user_id = ?", keyUUID, userUUID).First(&apiKey).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "API key not found",
				"code":  "API_KEY_NOT_FOUND",
			})
			return
		}

		// Revoke the key
		if err := db.Model(&apiKey).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to revoke API key",
				"code":  "API_KEY_REVOKE_ERROR",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "API key revoked successfully"})
	}
}

func GetDashboardAnalyticsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"analytics": "Dashboard analytics"})
	}
}

func GetConnectorMetricsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		connectorID := c.Param("id")
		window := c.Query("window")
		c.JSON(http.StatusOK, gin.H{
			"connector_id": connectorID,
			"window":       window,
			"metrics":      "Connector metrics",
		})
	}
}
