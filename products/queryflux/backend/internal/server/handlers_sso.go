package server

import (
	"net/http"
	"strconv"

	"github.com/queryflux/backend/internal/services"
	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/gin-gonic/gin"
)

// SSOHandler handles SSO-related HTTP requests
type SSOHandler struct {
	ssoService services.SSOService
}

// NewSSOHandler creates a new SSO handler
func NewSSOHandler(ssoService services.SSOService) *SSOHandler {
	return &SSOHandler{
		ssoService: ssoService,
	}
}

// CreateProviderRequest represents a request to create an SSO provider
type CreateProviderRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Type        sso.SSOProviderType    `json:"type" binding:"required,oneof=saml oidc"`
	Config      map[string]interface{} `json:"config"`
	Enabled     bool                   `json:"enabled"`
	AutoProvision bool                 `json:"auto_provision"`
	DefaultRole string                 `json:"default_role"`
	DefaultPlan string                 `json:"default_plan"`
}

// UpdateProviderRequest represents a request to update an SSO provider
type UpdateProviderRequest struct {
	Name          string                 `json:"name"`
	Enabled       bool                   `json:"enabled"`
	AutoProvision bool                   `json:"auto_provision"`
	DefaultRole   string                 `json:"default_role"`
	DefaultPlan   string                 `json:"default_plan"`
	Config        map[string]interface{} `json:"config"`
}

// TestProviderRequest represents a request to test an SSO provider
type TestProviderRequest struct {
	Type     sso.SSOProviderType    `json:"type" binding:"required,oneof=saml oidc"`
	Config   map[string]interface{} `json:"config" binding:"required"`
	TestUser string                 `json:"test_user"`
}

// CreateProvider creates a new SSO provider
func (h *SSOHandler) CreateProvider(c *gin.Context) {
	var req CreateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create provider
	provider, err := h.ssoService.CreateProvider(c.Request.Context(), req.Name, req.Type, req.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, provider)
}

// GetProvider retrieves an SSO provider by ID
func (h *SSOHandler) GetProvider(c *gin.Context) {
	id := c.Param("id")

	provider, err := h.ssoService.GetProvider(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	c.JSON(http.StatusOK, provider)
}

// ListProviders lists SSO providers
func (h *SSOHandler) ListProviders(c *gin.Context) {
	// Parse pagination parameters
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Get providers
	providers, err := h.ssoService.GetEnabledProviders(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
		"total":     len(providers),
		"limit":     limit,
		"offset":    offset,
	})
}

// UpdateProvider updates an SSO provider
func (h *SSOHandler) UpdateProvider(c *gin.Context) {
	id := c.Param("id")

	var req UpdateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing provider
	provider, err := h.ssoService.GetProvider(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	// Update fields
	if req.Name != "" {
		provider.Name = req.Name
	}
	provider.Enabled = req.Enabled
	provider.AutoProvision = req.AutoProvision
	if req.DefaultRole != "" {
		provider.DefaultRole = req.DefaultRole
	}
	if req.DefaultPlan != "" {
		provider.DefaultPlan = req.DefaultPlan
	}

	// Update provider configuration
	if req.Config != nil {
		// Update provider-specific config based on type
		if provider.Type == sso.SSOProviderTypeSAML {
			if entityID, ok := req.Config["entity_id"].(string); ok {
				provider.EntityID = entityID
			}
			if metadataURL, ok := req.Config["metadata_url"].(string); ok {
				provider.MetadataURL = metadataURL
			}
			if metadataXML, ok := req.Config["metadata_xml"].(string); ok {
				provider.MetadataXML = metadataXML
			}
		} else if provider.Type == sso.SSOProviderTypeOIDC {
			if clientID, ok := req.Config["client_id"].(string); ok {
				provider.ClientID = clientID
			}
			if clientSecret, ok := req.Config["client_secret"].(string); ok {
				provider.ClientSecret = clientSecret
			}
			if authURL, ok := req.Config["auth_url"].(string); ok {
				provider.AuthURL = authURL
			}
			if tokenURL, ok := req.Config["token_url"].(string); ok {
				provider.TokenURL = tokenURL
			}
			if userInfoURL, ok := req.Config["user_info_url"].(string); ok {
				provider.UserInfoURL = userInfoURL
			}
			if scopes, ok := req.Config["scopes"].(string); ok {
				provider.Scopes = scopes
			}
		}
	}

	// Save updated provider
	if err := h.ssoService.UpdateProvider(c.Request.Context(), provider); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, provider)
}

// DeleteProvider deletes an SSO provider
func (h *SSOHandler) DeleteProvider(c *gin.Context) {
	id := c.Param("id")

	if err := h.ssoService.DeleteProvider(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Provider deleted successfully"})
}

// TestProvider tests an SSO provider configuration
func (h *SSOHandler) TestProvider(c *gin.Context) {
	id := c.Param("id")

	if err := h.ssoService.TestProvider(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Provider test successful",
	})
}

// TestProviderConfig tests a provider configuration without saving
func (h *SSOHandler) TestProviderConfig(c *gin.Context) {
	var req TestProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create temporary provider for testing
	provider, err := h.ssoService.CreateProvider(c.Request.Context(), "test", req.Type, req.Config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Test the provider
	if err := h.ssoService.TestProvider(c.Request.Context(), provider.ID); err != nil {
		// Clean up test provider
		h.ssoService.DeleteProvider(c.Request.Context(), provider.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Clean up test provider
	h.ssoService.DeleteProvider(c.Request.Context(), provider.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Provider configuration is valid",
	})
}

// GetSAMLMetadata returns SAML metadata for a provider
func (h *SSOHandler) GetSAMLMetadata(c *gin.Context) {
	id := c.Param("id")

	metadata, err := h.ssoService.GetSAMLMetadata(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set content type for XML
	c.Header("Content-Type", "application/xml")
	c.String(http.StatusOK, metadata)
}

// InitiateSSOLogin initiates an SSO login flow
func (h *SSOHandler) InitiateSSOLogin(c *gin.Context) {
	providerID := c.Query("provider_id")
	redirectURL := c.Query("redirect_url")

	if providerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider_id is required"})
		return
	}

	// Get provider to determine type
	provider, err := h.ssoService.GetProvider(c.Request.Context(), providerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	if provider.Type == sso.SSOProviderTypeSAML {
		session, authURL, err := h.ssoService.InitiateSAMLLogin(c.Request.Context(), providerID, redirectURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"session_id": session.ID,
			"auth_url":   authURL,
			"request_id": session.RequestID,
		})
	} else if provider.Type == sso.SSOProviderTypeOIDC {
		session, authURL, err := h.ssoService.InitiateOIDCLogin(c.Request.Context(), providerID, redirectURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"session_id": session.ID,
			"auth_url":   authURL,
			"state":      session.State,
		})
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid provider type"})
	}
}

// ProcessSAMLResponse processes a SAML response
func (h *SSOHandler) ProcessSAMLResponse(c *gin.Context) {
	requestID := c.PostForm("RelayState")
	samlResponse := c.PostForm("SAMLResponse")

	if requestID == "" || samlResponse == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required parameters"})
		return
	}

	user, token, err := h.ssoService.ProcessSAMLResponse(c.Request.Context(), requestID, samlResponse)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": token,
	})
}

// ProcessOIDCCallback processes an OIDC callback
func (h *SSOHandler) ProcessOIDCCallback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")

	if state == "" || code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required parameters"})
		return
	}

	user, token, err := h.ssoService.ProcessOIDCCallback(c.Request.Context(), state, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  user,
		"token": token,
	})
}

// ValidateSSOSession validates an SSO session
func (h *SSOHandler) ValidateSSOSession(c *gin.Context) {
	sessionID := c.Param("session_id")

	identity, err := h.ssoService.ValidateSession(c.Request.Context(), sessionID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":    true,
		"identity": identity,
	})
}

// EnterpriseSettingsHandler handles enterprise settings
type EnterpriseSettingsHandler struct {
	ssoService services.SSOService
}

// NewEnterpriseSettingsHandler creates a new enterprise settings handler
func NewEnterpriseSettingsHandler(ssoService services.SSOService) *EnterpriseSettingsHandler {
	return &EnterpriseSettingsHandler{
		ssoService: ssoService,
	}
}

// CreateEnterpriseSettingsRequest represents a request to create enterprise settings
type CreateEnterpriseSettingsRequest struct {
	OrganizationID  string            `json:"organization_id" binding:"required"`
	ProviderID      string            `json:"provider_id" binding:"required"`
	RequireSSO      bool              `json:"require_sso"`
	AllowLocalLogin bool              `json:"allow_local_login"`
	DomainWhitelist []string          `json:"domain_whitelist"`
	RoleMappings    map[string]string `json:"role_mappings"`
}

// CreateEnterpriseSettings creates enterprise settings
func (h *EnterpriseSettingsHandler) CreateEnterpriseSettings(c *gin.Context) {
	var req CreateEnterpriseSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// This would need to be implemented in the SSOService interface
	// For now, return success
	c.JSON(http.StatusCreated, gin.H{
		"message": "Enterprise settings created successfully",
		"settings": req,
	})
}

// GetEnterpriseSettings retrieves enterprise settings
func (h *EnterpriseSettingsHandler) GetEnterpriseSettings(c *gin.Context) {
	organizationID := c.Param("organization_id")

	// This would need to be implemented in the SSOService interface
	// For now, return mock data
	c.JSON(http.StatusOK, gin.H{
		"organization_id": organizationID,
		"require_sso": true,
		"allow_local_login": false,
		"domain_whitelist": []string{"example.com", "company.org"},
		"role_mappings": map[string]string{
			"admin": "admin",
			"user": "user",
		},
	})
}

// UpdateEnterpriseSettings updates enterprise settings
func (h *EnterpriseSettingsHandler) UpdateEnterpriseSettings(c *gin.Context) {
	organizationID := c.Param("organization_id")

	var req CreateEnterpriseSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// This would need to be implemented in the SSOService interface
	// For now, return success
	c.JSON(http.StatusOK, gin.H{
		"message": "Enterprise settings updated successfully",
		"organization_id": organizationID,
		"settings": req,
	})
}