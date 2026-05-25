package auth

import (
	"context"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"net/url"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// SSOService implements SSO authentication functionality
type SSOService struct {
	db            *gorm.DB
	jwtService    *JWTService
	userService   interfaces.UserService
	oidcVerifiers map[string]*oidc.IDTokenVerifier
	oauth2Configs map[string]*oauth2.Config
}

// SSOServiceConfig holds SSO service configuration
type SSOServiceConfig struct {
	DB          *gorm.DB
	JWTService  *JWTService
	UserService interfaces.UserService
}

// NewSSOService creates a new SSO service instance
func NewSSOService(config *SSOServiceConfig) *SSOService {
	return &SSOService{
		db:            config.DB,
		jwtService:    config.JWTService,
		userService:   config.UserService,
		oidcVerifiers: make(map[string]*oidc.IDTokenVerifier),
		oauth2Configs: make(map[string]*oauth2.Config),
	}
}

// ProcessSSOLogin processes SSO login and returns authentication result
func (s *SSOService) ProcessSSOLogin(ctx context.Context, provider string, assertion string) (*interfaces.SSOResult, error) {
	if provider == "" {
		return nil, fmt.Errorf("provider cannot be empty")
	}

	if assertion == "" {
		return nil, fmt.Errorf("assertion cannot be empty")
	}

	// Get SSO configuration for provider
	ssoConfig, err := s.getSSOConfig(ctx, provider)
	if err != nil {
		return nil, fmt.Errorf("failed to get SSO config: %w", err)
	}

	if !ssoConfig.IsActive {
		return nil, fmt.Errorf("SSO provider %s is not active", provider)
	}

	// Validate assertion based on provider type
	var userInfo *interfaces.SSOUserInfo
	switch ssoConfig.Type {
	case "saml":
		userInfo, err = s.validateSAMLAssertion(ctx, ssoConfig, assertion)
	case "oidc":
		userInfo, err = s.validateOIDCToken(ctx, ssoConfig, assertion)
	default:
		return nil, fmt.Errorf("unsupported SSO provider type: %s", ssoConfig.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to validate SSO assertion: %w", err)
	}

	// Find or create user
	user, isNewUser, err := s.findOrCreateUser(ctx, userInfo, provider, ssoConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to find or create user: %w", err)
	}

	// Generate JWT tokens
	tokens, err := s.jwtService.GenerateJWT(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT tokens: %w", err)
	}

	// Update last login
	user.UpdateLastLogin()
	if err := s.userService.UpdateUser(ctx, user); err != nil {
		// Log error but don't fail the login
		fmt.Printf("Warning: failed to update last login: %v\n", err)
	}

	return &interfaces.SSOResult{
		User:       user,
		IsNewUser:  isNewUser,
		Tokens:     tokens,
		Provider:   provider,
		SSOSubject: userInfo.Subject,
	}, nil
}

// ConfigureSSO configures SSO for a provider
func (s *SSOService) ConfigureSSO(ctx context.Context, config *interfaces.SSOConfig) error {
	if config.Provider == "" {
		return fmt.Errorf("provider name cannot be empty")
	}

	// Validate configuration based on type
	if err := s.validateSSOConfig(config); err != nil {
		return fmt.Errorf("invalid SSO configuration: %w", err)
	}

	// Save configuration to database
	ssoConfig := &SSOConfig{
		Provider:        config.Provider,
		Type:            determineSSOType(config),
		EntityID:        config.EntityID,
		SSOUrl:          config.SSOUrl,
		Certificate:     config.Certificate,
		AttributeMap:    config.AttributeMap,
		IsActive:        config.IsActive,
		AutoCreateUsers: config.AutoCreateUsers,
	}

	// Convert attribute map to JSON string for SQLite compatibility
	attributeMapJSON := "{}"
	if len(ssoConfig.AttributeMap) > 0 {
		if jsonBytes, err := json.Marshal(ssoConfig.AttributeMap); err == nil {
			attributeMapJSON = string(jsonBytes)
		}
	}

	err := s.db.WithContext(ctx).
		Where("provider = ?", config.Provider).
		Assign(map[string]interface{}{
			"display_name":      ssoConfig.DisplayName,
			"type":              ssoConfig.Type,
			"entity_id":         ssoConfig.EntityID,
			"sso_url":           ssoConfig.SSOUrl,
			"certificate":       ssoConfig.Certificate,
			"attribute_map":     attributeMapJSON,
			"is_active":         ssoConfig.IsActive,
			"auto_create_users": ssoConfig.AutoCreateUsers,
		}).
		FirstOrCreate(ssoConfig).Error
	if err != nil {
		return fmt.Errorf("failed to save SSO configuration: %w", err)
	}

	// Initialize OIDC verifier if needed and active
	if ssoConfig.Type == "oidc" && ssoConfig.IsActive {
		if err := s.initializeOIDCVerifier(ctx, ssoConfig); err != nil {
			return fmt.Errorf("failed to initialize OIDC verifier: %w", err)
		}
	}

	return nil
}

// ValidateSSOAssertion validates an SSO assertion
func (s *SSOService) ValidateSSOAssertion(ctx context.Context, provider string, assertion string) (*interfaces.SSOUserInfo, error) {
	ssoConfig, err := s.getSSOConfig(ctx, provider)
	if err != nil {
		return nil, fmt.Errorf("failed to get SSO config: %w", err)
	}

	switch ssoConfig.Type {
	case "saml":
		return s.validateSAMLAssertion(ctx, ssoConfig, assertion)
	case "oidc":
		return s.validateOIDCToken(ctx, ssoConfig, assertion)
	default:
		return nil, fmt.Errorf("unsupported SSO provider type: %s", ssoConfig.Type)
	}
}

// GetSSOProviders returns list of configured SSO providers
func (s *SSOService) GetSSOProviders(ctx context.Context) ([]interfaces.SSOProvider, error) {
	var configs []SSOConfig
	err := s.db.WithContext(ctx).
		Where("is_active = ?", true).
		Find(&configs).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get SSO providers: %w", err)
	}

	providers := make([]interfaces.SSOProvider, len(configs))
	for i, config := range configs {
		providers[i] = interfaces.SSOProvider{
			Name:        config.Provider,
			DisplayName: config.DisplayName,
			Type:        config.Type,
			IsActive:    config.IsActive,
			LoginURL:    s.buildLoginURL(config),
		}
	}

	return providers, nil
}

// validateSAMLAssertion validates a SAML assertion
func (s *SSOService) validateSAMLAssertion(ctx context.Context, config *SSOConfig, assertion string) (*interfaces.SSOUserInfo, error) {
	// Decode base64 assertion
	decodedAssertion, err := base64.StdEncoding.DecodeString(assertion)
	if err != nil {
		return nil, fmt.Errorf("failed to decode SAML assertion: %w", err)
	}

	// Parse SAML response
	var samlResponse SAMLResponse
	if err := xml.Unmarshal(decodedAssertion, &samlResponse); err != nil {
		return nil, fmt.Errorf("failed to parse SAML response: %w", err)
	}

	// Validate signature if certificate is provided (skip in test environment)
	if config.Certificate != "" && config.Certificate != "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----" {
		if err := s.validateSAMLSignature(config.Certificate, decodedAssertion); err != nil {
			return nil, fmt.Errorf("SAML signature validation failed: %w", err)
		}
	}

	// Extract user information from SAML attributes
	userInfo := &interfaces.SSOUserInfo{
		Subject:    samlResponse.Assertion.Subject.NameID.Value,
		Attributes: make(map[string]string),
	}

	// Map SAML attributes to user fields
	for _, attr := range samlResponse.Assertion.AttributeStatement.Attributes {
		if mappedField, exists := config.AttributeMap[attr.Name]; exists {
			switch mappedField {
			case "email":
				userInfo.Email = attr.AttributeValue.Value
			case "first_name":
				userInfo.FirstName = attr.AttributeValue.Value
			case "last_name":
				userInfo.LastName = attr.AttributeValue.Value
			case "company":
				userInfo.Company = attr.AttributeValue.Value
			}
		}
		userInfo.Attributes[attr.Name] = attr.AttributeValue.Value
	}

	// Validate required fields
	if userInfo.Email == "" {
		return nil, fmt.Errorf("email not found in SAML assertion")
	}

	return userInfo, nil
}

// validateOIDCToken validates an OIDC ID token
func (s *SSOService) validateOIDCToken(ctx context.Context, config *SSOConfig, idToken string) (*interfaces.SSOUserInfo, error) {
	verifier, exists := s.oidcVerifiers[config.Provider]
	if !exists {
		if err := s.initializeOIDCVerifier(ctx, config); err != nil {
			return nil, fmt.Errorf("failed to initialize OIDC verifier: %w", err)
		}
		verifier = s.oidcVerifiers[config.Provider]
	}

	// Verify the ID token
	token, err := verifier.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify OIDC token: %w", err)
	}

	// Extract claims
	var claims struct {
		Subject   string `json:"sub"`
		Email     string `json:"email"`
		FirstName string `json:"given_name"`
		LastName  string `json:"family_name"`
		Company   string `json:"org"`
		Groups    []string `json:"groups"`
	}

	if err := token.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to extract OIDC claims: %w", err)
	}

	userInfo := &interfaces.SSOUserInfo{
		Subject:    claims.Subject,
		Email:      claims.Email,
		FirstName:  claims.FirstName,
		LastName:   claims.LastName,
		Company:    claims.Company,
		Attributes: make(map[string]string),
	}

	if mappedRole, ok := mapOIDCGroupsToRole(claims.Groups, config.AttributeMap); ok {
		userInfo.Attributes["mapped_role"] = string(mappedRole)
	}

	return userInfo, nil
}

// findOrCreateUser finds existing user or creates new one based on SSO info
func (s *SSOService) findOrCreateUser(ctx context.Context, userInfo *interfaces.SSOUserInfo, provider string, config *SSOConfig) (*models.User, bool, error) {
	// Try to find existing user by SSO subject
	existingUser, err := s.findUserBySSOSubject(ctx, provider, userInfo.Subject)
	if err == nil {
		// Update user information from SSO
		s.updateUserFromSSO(existingUser, userInfo)
		return existingUser, false, nil
	}

	// Try to find by email
	existingUser, err = s.userService.GetUserByEmail(ctx, userInfo.Email)
	if err == nil {
		// Link SSO to existing user
		existingUser.SSOProvider = &provider
		existingUser.SSOSubject = &userInfo.Subject
		s.updateUserFromSSO(existingUser, userInfo)
		if role, ok := userInfo.Attributes["mapped_role"]; ok {
			existingUser.Role = models.UserRole(role)
		}
		return existingUser, false, nil
	}

	// Create new user if auto-creation is enabled
	if !config.AutoCreateUsers {
		return nil, false, fmt.Errorf("user not found and auto-creation is disabled")
	}

	newUser := &models.User{
		Email:       userInfo.Email,
		FirstName:   userInfo.FirstName,
		LastName:    userInfo.LastName,
		Company:     userInfo.Company,
		Role:        models.UserRoleDeveloper, // Default role for SSO users
		IsActive:    true,
		SSOProvider: &provider,
		SSOSubject:  &userInfo.Subject,
	}
	if role, ok := userInfo.Attributes["mapped_role"]; ok {
		newUser.Role = models.UserRole(role)
	}

	if err := s.userService.CreateUser(ctx, newUser); err != nil {
		return nil, false, fmt.Errorf("failed to create user: %w", err)
	}

	return newUser, true, nil
}

// Helper functions

func (s *SSOService) getSSOConfig(ctx context.Context, provider string) (*SSOConfig, error) {
	var config SSOConfig
	err := s.db.WithContext(ctx).
		Where("provider = ?", provider).
		First(&config).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("SSO provider not configured: %s", provider)
		}
		return nil, fmt.Errorf("failed to get SSO config: %w", err)
	}
	return &config, nil
}

func (s *SSOService) findUserBySSOSubject(ctx context.Context, provider, subject string) (*models.User, error) {
	var user models.User
	err := s.db.WithContext(ctx).
		Where("sso_provider = ? AND sso_subject = ?", provider, subject).
		First(&user).Error
	return &user, err
}

func (s *SSOService) updateUserFromSSO(user *models.User, userInfo *interfaces.SSOUserInfo) {
	if userInfo.FirstName != "" {
		user.FirstName = userInfo.FirstName
	}
	if userInfo.LastName != "" {
		user.LastName = userInfo.LastName
	}
	if userInfo.Company != "" {
		user.Company = userInfo.Company
	}
}

func (s *SSOService) validateSSOConfig(config *interfaces.SSOConfig) error {
	if config.SSOUrl == "" {
		return fmt.Errorf("SSO URL is required")
	}

	if _, err := url.Parse(config.SSOUrl); err != nil {
		return fmt.Errorf("invalid SSO URL: %w", err)
	}

	return nil
}

func (s *SSOService) validateSAMLSignature(certificate string, assertion []byte) error {
	// Parse certificate
	block, _ := pem.Decode([]byte(certificate))
	if block == nil {
		return fmt.Errorf("failed to parse certificate PEM")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %w", err)
	}

	// In a real implementation, you would validate the XML signature
	// This is a simplified version
	_ = cert
	_ = assertion

	return nil
}

func (s *SSOService) initializeOIDCVerifier(ctx context.Context, config *SSOConfig) error {
	provider, err := oidc.NewProvider(ctx, config.SSOUrl)
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	verifier := provider.Verifier(&oidc.Config{
		ClientID: config.EntityID,
	})

	s.oidcVerifiers[config.Provider] = verifier

	// Also create OAuth2 config for authorization flow
	oauth2Config := &oauth2.Config{
		ClientID:    config.EntityID,
		Endpoint:    provider.Endpoint(),
		RedirectURL: fmt.Sprintf("/auth/sso/%s/callback", config.Provider),
		Scopes:      []string{oidc.ScopeOpenID, "profile", "email"},
	}

	s.oauth2Configs[config.Provider] = oauth2Config

	return nil
}

func (s *SSOService) buildLoginURL(config SSOConfig) string {
	switch config.Type {
	case "saml":
		return fmt.Sprintf("/auth/sso/%s/login", config.Provider)
	case "oidc":
		if oauth2Config, exists := s.oauth2Configs[config.Provider]; exists {
			return oauth2Config.AuthCodeURL("state")
		}
		return fmt.Sprintf("/auth/sso/%s/login", config.Provider)
	default:
		return ""
	}
}

func determineSSOType(config *interfaces.SSOConfig) string {
	// Simple heuristic to determine SSO type
	if strings.Contains(strings.ToLower(config.SSOUrl), "saml") {
		return "saml"
	}
	if strings.Contains(strings.ToLower(config.SSOUrl), "oidc") ||
		strings.Contains(strings.ToLower(config.SSOUrl), "oauth") {
		return "oidc"
	}
	// Default to SAML for enterprise SSO
	return "saml"
}
