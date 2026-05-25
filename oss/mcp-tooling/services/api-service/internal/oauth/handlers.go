package oauth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/models"
	"gorm.io/gorm"
)

// Handlers provides OAuth HTTP handlers
type Handlers struct {
	service *Service
}

// NewHandlers creates new OAuth handlers
func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

// GetAuthURL handles getting OAuth authorization URL
func (h *Handlers) GetAuthURL(c *gin.Context) {
	var req struct {
		ProviderID  string  `json:"provider_id" binding:"required"`
		RedirectURI string  `json:"redirect_uri" binding:"required"`
		UserID      *string `json:"user_id,omitempty"`
		ConnectorID *string `json:"connector_id,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	authURL, state, err := h.service.GetAuthorizationURL(c.Request.Context(), req.ProviderID, req.RedirectURI, req.UserID, req.ConnectorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
			"code":  "AUTH_URL_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authorization_url": authURL,
		"state":             state,
	})
}

// HandleCallback handles OAuth callback
func (h *Handlers) HandleCallback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")
	errorParam := c.Query("error")

	if errorParam != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "OAuth authorization failed",
			"code":  "OAUTH_ERROR",
			"details": gin.H{
				"error":       errorParam,
				"description": c.Query("error_description"),
			},
		})
		return
	}

	if state == "" || code == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Missing state or code parameter",
			"code":  "MISSING_PARAMS",
		})
		return
	}

	token, userInfo, err := h.service.ExchangeCodeForToken(c.Request.Context(), state, code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to exchange code for token",
			"code":  "TOKEN_EXCHANGE_FAILED",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	// Get the stored state to retrieve user and connector info
	oauthState, exists := h.service.states[state]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid state",
			"code":  "INVALID_STATE",
		})
		return
	}

	// Save OAuth connection if user ID is provided
	if oauthState.UserID != nil {
		if err := h.service.SaveOAuthConnection(c.Request.Context(), *oauthState.UserID, oauthState.ProviderID, token, userInfo, oauthState.ConnectorID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to save OAuth connection",
				"code":  "SAVE_CONNECTION_FAILED",
				"details": gin.H{
					"error": err.Error(),
				},
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": token.AccessToken,
		"token_type":   token.TokenType,
		"expires_in":   token.ExpiresIn,
		"scope":        token.Scope,
		"user_info":    userInfo,
	})
}

// ListConnections handles listing OAuth connections
func (h *Handlers) ListConnections(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	connections, err := h.service.ListOAuthConnections(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list OAuth connections",
			"code":  "LIST_CONNECTIONS_FAILED",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connections": connections,
	})
}

// GetConnection handles getting a specific OAuth connection
func (h *Handlers) GetConnection(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	providerID := c.Param("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider ID is required",
			"code":  "MISSING_PROVIDER_ID",
		})
		return
	}

	connection, err := h.service.GetOAuthConnection(c.Request.Context(), userID.(string), providerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "OAuth connection not found",
			"code":  "CONNECTION_NOT_FOUND",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connection": connection,
	})
}

// DeleteConnection handles deleting an OAuth connection
func (h *Handlers) DeleteConnection(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	providerID := c.Param("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider ID is required",
			"code":  "MISSING_PROVIDER_ID",
		})
		return
	}

	if err := h.service.DeleteOAuthConnection(c.Request.Context(), userID.(string), providerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete OAuth connection",
			"code":  "DELETE_CONNECTION_FAILED",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "OAuth connection deleted successfully",
	})
}

// RefreshToken handles refreshing an OAuth access token
func (h *Handlers) RefreshToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	providerID := c.Param("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider ID is required",
			"code":  "MISSING_PROVIDER_ID",
		})
		return
	}

	token, err := h.service.RefreshToken(c.Request.Context(), userID.(string), providerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Failed to refresh token",
			"code":  "REFRESH_TOKEN_FAILED",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": token.AccessToken,
		"token_type":   token.TokenType,
		"expires_in":   token.ExpiresIn,
		"scope":        token.Scope,
	})
}

// GetProviders handles listing available OAuth providers
func (h *Handlers) GetProviders(c *gin.Context) {
	providers := h.service.GetProviders()

	// Return only provider info without sensitive data
	providerList := make(map[string]interface{})
	for id, provider := range providers {
		providerList[id] = gin.H{
			"id":     id,
			"name":   provider.Name,
			"scopes": provider.Scopes,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": providerList,
	})
}

// ValidateToken handles validating an OAuth access token
func (h *Handlers) ValidateToken(c *gin.Context) {
	var req struct {
		ProviderID  string `json:"provider_id" binding:"required"`
		AccessToken string `json:"access_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	userInfo, err := h.service.ValidateToken(c.Request.Context(), req.ProviderID, req.AccessToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid token",
			"code":  "INVALID_TOKEN",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":     true,
		"user_info": userInfo,
	})
}

// RevokeToken handles revoking an OAuth access token
func (h *Handlers) RevokeToken(c *gin.Context) {
	var req struct {
		ProviderID  string `json:"provider_id" binding:"required"`
		AccessToken string `json:"access_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	if err := h.service.RevokeToken(c.Request.Context(), req.ProviderID, req.AccessToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to revoke token",
			"code":  "REVOKE_TOKEN_FAILED",
			"details": gin.H{
				"error": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Token revoked successfully",
	})
}

// ConnectConnector handles OAuth flow for connecting a specific connector
func (h *Handlers) ConnectConnector(c *gin.Context) {
	var req struct {
		ConnectorID string `json:"connector_id" binding:"required"`
		ProviderID  string `json:"provider_id" binding:"required"`
		RedirectURI string `json:"redirect_uri" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	userIDStr := userID.(string)
	authURL, state, err := h.service.GetAuthorizationURL(c.Request.Context(), req.ProviderID, req.RedirectURI, &userIDStr, &req.ConnectorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
			"code":  "AUTH_URL_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authorization_url": authURL,
		"state":             state,
	})
}

// ListConnectorConnections handles listing OAuth connections for a specific connector
func (h *Handlers) ListConnectorConnections(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
			"code":  "NOT_AUTHENTICATED",
		})
		return
	}

	connectorID := c.Param("connector_id")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	// Get database connection
	db, exists := c.MustGet("db").(*gorm.DB)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Database connection not found",
			"code":  "DB_ERROR",
		})
		return
	}

	// Find OAuth connections linked to this connector
	var connections []models.OAuthConnection
	err := db.Where("user_id = ? AND connector_id = ?", userID.(string), connectorID).Find(&connections).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list connector OAuth connections",
			"code":  "LIST_CONNECTIONS_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connections": connections,
	})
}

// GetOAuthConfig returns OAuth configuration for the frontend
func (h *Handlers) GetOAuthConfig(c *gin.Context) {
	// Return safe configuration without secrets
	providers := h.service.GetProviders()
	providerList := make(map[string]interface{})

	for id, provider := range providers {
		providerList[id] = gin.H{
			"id":     id,
			"name":   provider.Name,
			"scopes": provider.Scopes,
		}
	}

	// Get current user info if authenticated
	var userInfo *gin.H
	if userID, exists := c.Get("user_id"); exists {
		userInfo = &gin.H{
			"user_id": userID,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"providers":         providerList,
		"user":              userInfo,
		"pkce_enabled":      true,
		"state_ttl_minutes": 10,
	})
}

// Webhook handles OAuth webhooks from providers (if supported)
func (h *Handlers) Webhook(c *gin.Context) {
	providerID := c.Param("provider_id")
	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider ID is required",
			"code":  "MISSING_PROVIDER_ID",
		})
		return
	}

	// Get the request body
	var webhookData map[string]interface{}
	if err := c.ShouldBindJSON(&webhookData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid webhook payload",
			"code":  "INVALID_WEBHOOK",
		})
		return
	}

	// TODO: Implement provider-specific webhook handling
	// This could handle events like token revocation, account changes, etc.

	c.JSON(http.StatusOK, gin.H{
		"message":     "Webhook received",
		"provider_id": providerID,
	})
}
