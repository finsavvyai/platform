package services

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/domain/sso"
	"github.com/queryflux/backend/internal/infrastructure/sso/providers"
)

// ssoServiceImpl implements the SSOService interface
type ssoServiceImpl struct {
	providerRepo        sso.SSOProviderRepository
	identityRepo        sso.SSOIdentityRepository
	settingsRepo        sso.EnterpriseSettingsRepository
	userRepo            repositories.UserRepository
	sessionRepo         sso.SSOSessionRepository
	provisioningService *EnterpriseProvisioningService
	config              *SSOConfig
	samlProviders       map[string]*providers.SAMLProvider
	oidcProviders       map[string]*providers.OIDCProvider
}

// NewSSOService creates a new SSO service implementation
func NewSSOService(
	providerRepo sso.SSOProviderRepository,
	identityRepo sso.SSOIdentityRepository,
	settingsRepo sso.EnterpriseSettingsRepository,
	userRepo repositories.UserRepository,
	sessionRepo sso.SSOSessionRepository,
	provisioningService *EnterpriseProvisioningService,
	config *SSOConfig,
) SSOService {
	return &ssoServiceImpl{
		providerRepo:        providerRepo,
		identityRepo:        identityRepo,
		settingsRepo:        settingsRepo,
		userRepo:            userRepo,
		sessionRepo:         sessionRepo,
		provisioningService: provisioningService,
		config:              config,
		samlProviders:       make(map[string]*providers.SAMLProvider),
		oidcProviders:       make(map[string]*providers.OIDCProvider),
	}
}

func (s *ssoServiceImpl) initializeSAMLProvider(provider *sso.SSOProvider) error {
	config := &providers.SAMLConfig{
		EntityID:          provider.EntityID,
		ACSURL:            s.config.ACSURL,
		SLOURL:            s.config.SLOURL,
		MetadataURL:       provider.MetadataURL,
		MetadataXML:       provider.MetadataXML,
		SignRequests:      true,
		SignAssertions:    true,
		AllowIDPInitiated: false,
		AttributeMapping:  provider.GetAttributeMapping(),
	}

	samlProvider, err := providers.NewSAMLProvider(config)
	if err != nil {
		return err
	}

	s.samlProviders[provider.ID] = samlProvider
	return nil
}

func (s *ssoServiceImpl) initializeOIDCProvider(provider *sso.SSOProvider) error {
	config := &providers.OIDCConfig{
		ClientID:     provider.ClientID,
		ClientSecret: provider.ClientSecret,
		AuthURL:      provider.AuthURL,
		TokenURL:     provider.TokenURL,
		UserInfoURL:  provider.UserInfoURL,
		Scopes:       []string{"openid", "email", "profile"},
		RedirectURL:  s.config.CallbackURL,
		SkipVerify:   false,
	}

	oidcProvider, err := providers.NewOIDCProvider(config)
	if err != nil {
		return err
	}

	s.oidcProviders[provider.ID] = oidcProvider
	return nil
}

func (s *ssoServiceImpl) generateJWTToken(user *entities.User) (string, error) {
	return "jwt-token-placeholder", nil
}

func getStringClaim(claims map[string]interface{}, key string) string {
	if value, ok := claims[key].(string); ok {
		return value
	}
	return ""
}

func extractIssuerFromAuthURL(authURL string) string {
	parsedURL, err := url.Parse(authURL)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
}

// GetIdentity retrieves an SSO identity by ID
func (s *ssoServiceImpl) GetIdentity(ctx context.Context, id string) (*sso.SSOIdentity, error) {
	return s.identityRepo.GetByID(ctx, id)
}

// GetIdentityByProviderAndExternalID retrieves identity by provider and external ID
func (s *ssoServiceImpl) GetIdentityByProviderAndExternalID(ctx context.Context, providerID, externalID string) (*sso.SSOIdentity, error) {
	return s.identityRepo.GetByProviderAndExternalID(ctx, providerID, externalID)
}

// GetIdentitiesByUser retrieves identities for a user
func (s *ssoServiceImpl) GetIdentitiesByUser(ctx context.Context, userID string) ([]*sso.SSOIdentity, error) {
	return s.identityRepo.GetByUserID(ctx, userID)
}

// LinkIdentityToUser links an identity to a user
func (s *ssoServiceImpl) LinkIdentityToUser(ctx context.Context, identityID, userID string) error {
	return s.identityRepo.LinkToUser(ctx, identityID, userID)
}

// UnlinkIdentityFromUser unlinks an identity from a user
func (s *ssoServiceImpl) UnlinkIdentityFromUser(ctx context.Context, identityID string) error {
	return s.identityRepo.UnlinkFromUser(ctx, identityID)
}

// DeleteIdentity deletes an SSO identity
func (s *ssoServiceImpl) DeleteIdentity(ctx context.Context, identityID string) error {
	return s.identityRepo.Delete(ctx, identityID)
}

// CreateEnterpriseSettings creates enterprise SSO settings
func (s *ssoServiceImpl) CreateEnterpriseSettings(ctx context.Context, organizationID, providerID string) (*sso.EnterpriseSettings, error) {
	settings := &sso.EnterpriseSettings{
		OrganizationID: organizationID,
		ProviderID:     providerID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if err := s.settingsRepo.Create(ctx, settings); err != nil {
		return nil, err
	}
	return settings, nil
}

// GetEnterpriseSettings retrieves enterprise settings by organization
func (s *ssoServiceImpl) GetEnterpriseSettings(ctx context.Context, organizationID string) (*sso.EnterpriseSettings, error) {
	return s.settingsRepo.GetByOrganization(ctx, organizationID)
}

// UpdateEnterpriseSettings updates enterprise settings
func (s *ssoServiceImpl) UpdateEnterpriseSettings(ctx context.Context, settings *sso.EnterpriseSettings, config map[string]interface{}) error {
	settings.UpdatedAt = time.Now()
	return s.settingsRepo.Update(ctx, settings)
}

// DeleteEnterpriseSettings deletes enterprise settings
func (s *ssoServiceImpl) DeleteEnterpriseSettings(ctx context.Context, id string) error {
	return s.settingsRepo.Delete(ctx, id)
}

// ListEnterpriseSettings lists enterprise settings
func (s *ssoServiceImpl) ListEnterpriseSettings(ctx context.Context, limit, offset int) ([]*sso.EnterpriseSettings, error) {
	return s.settingsRepo.List(ctx, limit, offset)
}
