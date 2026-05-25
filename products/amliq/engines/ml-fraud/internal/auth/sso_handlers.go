package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/logger"
	"quantumbeam/internal/interfaces"
)

// SSOHandlers provides HTTP handlers for SSO authentication
type SSOHandlers struct {
	ssoService *SSOService
}

// NewSSOHandlers creates new SSO handlers
func NewSSOHandlers(ssoService *SSOService) *SSOHandlers {
	return &SSOHandlers{
		ssoService: ssoService,
	}
}

// InitiateSSOLogin initiates SSO login flow
func (h *SSOHandlers) InitiateSSOLogin(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider parameter is required",
			"code":  "MISSING_PROVIDER",
		})
		return
	}

	// Get SSO providers to validate
	providers, err := h.ssoService.GetSSOProviders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get SSO providers",
			"code":  "SSO_PROVIDER_ERROR",
		})
		return
	}

	// Find the requested provider
	var ssoProvider *interfaces.SSOProvider
	for _, p := range providers {
		if p.Name == provider {
			ssoProvider = &p
			break
		}
	}

	if ssoProvider == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "SSO provider not found or not active",
			"code":  "PROVIDER_NOT_FOUND",
		})
		return
	}

	// Redirect to SSO provider
	if ssoProvider.Type == "oidc" {
		loginURL, state, err := h.buildOIDCLoginURL(c, provider)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to build OIDC login URL",
				"code":    "OIDC_LOGIN_URL_ERROR",
				"details": err.Error(),
			})
			return
		}
		h.setStateCookie(c, state)
		c.JSON(http.StatusOK, gin.H{
			"login_url": loginURL,
			"provider":  ssoProvider.Name,
			"type":      ssoProvider.Type,
			"state":     state,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"login_url": ssoProvider.LoginURL,
		"provider":  ssoProvider.Name,
		"type":      ssoProvider.Type,
	})
}

// HandleSSOCallback handles SSO callback
func (h *SSOHandlers) HandleSSOCallback(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider parameter is required",
			"code":  "MISSING_PROVIDER",
		})
		return
	}

	// Get assertion from request
	var assertion string

	// For SAML, assertion comes in SAMLResponse parameter
	if samlResponse := c.PostForm("SAMLResponse"); samlResponse != "" {
		assertion = samlResponse
	} else if c.Query("SAMLResponse") != "" {
		assertion = c.Query("SAMLResponse")
	}

	// For OIDC, we get authorization code
	if code := c.Query("code"); code != "" && assertion == "" {
		if !h.handleOIDCState(c) {
			return
		}
		idToken, err := h.exchangeCodeForToken(c, provider, code)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to exchange authorization code",
				"code":    "TOKEN_EXCHANGE_FAILED",
				"details": err.Error(),
			})
			return
		}
		assertion = idToken
	}

	if assertion == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No SSO assertion found in request",
			"code":  "MISSING_ASSERTION",
		})
		return
	}

	// Process SSO login
	result, err := h.ssoService.ProcessSSOLogin(c.Request.Context(), provider, assertion)
	if err != nil {
		logger.NewAuditLogger(nil, nil).LogAuthFailure(
			c.ClientIP(),
			c.FullPath(),
			c.GetHeader("X-Request-ID"),
			"sso_auth_failed:"+provider,
		)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "SSO authentication failed",
			"code":    "SSO_AUTH_FAILED",
			"details": err.Error(),
		})
		return
	}

	logger.NewAuditLogger(nil, nil).LogAuthSuccess(
		result.User.UserID,
		c.ClientIP(),
		c.FullPath(),
		c.GetHeader("X-Request-ID"),
	)

	// Return successful authentication result
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"user":        result.User,
		"is_new_user": result.IsNewUser,
		"tokens":      result.Tokens,
		"provider":    result.Provider,
	})
}

// ConfigureSSO configures SSO for a provider (admin only)
func (h *SSOHandlers) ConfigureSSO(c *gin.Context) {
	var config interfaces.SSOConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid SSO configuration",
			"code":    "INVALID_CONFIG",
			"details": err.Error(),
		})
		return
	}

	// Validate required fields
	if config.Provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider name is required",
			"code":  "MISSING_PROVIDER",
		})
		return
	}

	if config.SSOUrl == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "SSO URL is required",
			"code":  "MISSING_SSO_URL",
		})
		return
	}

	// Configure SSO
	err := h.ssoService.ConfigureSSO(c.Request.Context(), &config)
	if err != nil {
		logger.NewAuditLogger(nil, nil).LogAuthFailure(
			c.ClientIP(),
			c.FullPath(),
			c.GetHeader("X-Request-ID"),
			sanitizeAuditDetail("sso_config_failed:"+config.Provider),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to configure SSO",
			"code":    "SSO_CONFIG_FAILED",
			"details": err.Error(),
		})
		return
	}

	userID, _ := c.Get("user_id")
	userIDValue, _ := userID.(string)
	logger.NewAuditLogger(nil, nil).LogAuthSuccess(
		userIDValue,
		c.ClientIP(),
		c.FullPath(),
		c.GetHeader("X-Request-ID"),
	)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "SSO configuration saved successfully",
		"provider": config.Provider,
	})
}

// GetSSOProviders returns list of configured SSO providers
func (h *SSOHandlers) GetSSOProviders(c *gin.Context) {
	providers, err := h.ssoService.GetSSOProviders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get SSO providers",
			"code":    "SSO_PROVIDER_ERROR",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
	})
}

// ValidateSSO validates SSO assertion without full login
func (h *SSOHandlers) ValidateSSO(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider parameter is required",
			"code":  "MISSING_PROVIDER",
		})
		return
	}

	var request struct {
		Assertion string `json:"assertion" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"code":    "INVALID_REQUEST",
			"details": err.Error(),
		})
		return
	}

	// Validate SSO assertion
	userInfo, err := h.ssoService.ValidateSSOAssertion(c.Request.Context(), provider, request.Assertion)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "SSO assertion validation failed",
			"code":    "SSO_VALIDATION_FAILED",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":     true,
		"user_info": userInfo,
	})
}

// exchangeCodeForToken exchanges authorization code for ID token (OIDC)
func (h *SSOHandlers) exchangeCodeForToken(c *gin.Context, provider, code string) (string, error) {
	return h.exchangeOIDCCodeForIDToken(c, provider, code)
}

// RegisterSSORoutes registers SSO routes with the Gin router
func RegisterSSORoutes(router *gin.RouterGroup, handlers *SSOHandlers, authMiddleware *AuthMiddleware) {
	sso := router.Group("/sso")
	{
		// Public SSO endpoints
		sso.GET("/providers", handlers.GetSSOProviders)
		sso.GET("/:provider/login", handlers.InitiateSSOLogin)
		sso.POST("/:provider/callback", handlers.HandleSSOCallback)
		sso.GET("/:provider/callback", handlers.HandleSSOCallback) // Some providers use GET
		sso.POST("/:provider/validate", handlers.ValidateSSO)

		// Admin-only SSO configuration endpoints
		adminSSO := sso.Group("/config")
		adminSSO.Use(authMiddleware.JWTAuth())
		adminSSO.Use(authMiddleware.RequireRole("admin"))
		{
			adminSSO.POST("/", handlers.ConfigureSSO)
		}
	}
}
