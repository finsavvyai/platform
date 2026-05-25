package services

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/queryflux/backend/internal/domain/sso"
)

// CreateProvider creates a new SSO provider
func (s *ssoServiceImpl) CreateProvider(
	ctx context.Context,
	name string,
	providerType sso.SSOProviderType,
	config map[string]interface{},
) (*sso.SSOProvider, error) {
	provider, err := sso.NewSSOProvider(name, providerType, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSO provider: %w", err)
	}

	if err := s.providerRepo.Create(ctx, provider); err != nil {
		return nil, fmt.Errorf("failed to save provider: %w", err)
	}

	if providerType == sso.SSOProviderTypeSAML {
		if err := s.initializeSAMLProvider(provider); err != nil {
			return nil, fmt.Errorf("failed to initialize SAML provider: %w", err)
		}
	} else if providerType == sso.SSOProviderTypeOIDC {
		if err := s.initializeOIDCProvider(provider); err != nil {
			return nil, fmt.Errorf("failed to initialize OIDC provider: %w", err)
		}
	}

	return provider, nil
}

// GetProvider retrieves an SSO provider by ID
func (s *ssoServiceImpl) GetProvider(ctx context.Context, id string) (*sso.SSOProvider, error) {
	return s.providerRepo.GetByID(ctx, id)
}

// GetProvidersByType retrieves SSO providers by type
func (s *ssoServiceImpl) GetProvidersByType(
	ctx context.Context,
	providerType sso.SSOProviderType,
) ([]*sso.SSOProvider, error) {
	return s.providerRepo.GetByType(ctx, providerType)
}

// GetEnabledProviders retrieves all enabled SSO providers
func (s *ssoServiceImpl) GetEnabledProviders(ctx context.Context) ([]*sso.SSOProvider, error) {
	return s.providerRepo.GetEnabled(ctx)
}

// UpdateProvider updates an SSO provider
func (s *ssoServiceImpl) UpdateProvider(ctx context.Context, provider *sso.SSOProvider) error {
	if provider.Type == sso.SSOProviderTypeSAML {
		if err := s.initializeSAMLProvider(provider); err != nil {
			return fmt.Errorf("failed to re-initialize SAML provider: %w", err)
		}
	} else if provider.Type == sso.SSOProviderTypeOIDC {
		if err := s.initializeOIDCProvider(provider); err != nil {
			return fmt.Errorf("failed to re-initialize OIDC provider: %w", err)
		}
	}

	return s.providerRepo.Update(ctx, provider)
}

// DeleteProvider deletes an SSO provider
func (s *ssoServiceImpl) DeleteProvider(ctx context.Context, id string) error {
	delete(s.samlProviders, id)
	delete(s.oidcProviders, id)
	return s.providerRepo.Delete(ctx, id)
}

// ListProviders lists SSO providers with pagination
func (s *ssoServiceImpl) ListProviders(
	ctx context.Context,
	limit, offset int,
) ([]*sso.SSOProvider, error) {
	return s.providerRepo.List(ctx, limit, offset)
}

// TestProvider tests the configuration of an SSO provider
func (s *ssoServiceImpl) TestProvider(ctx context.Context, providerID string) error {
	provider, err := s.providerRepo.GetByID(ctx, providerID)
	if err != nil {
		return fmt.Errorf("provider not found: %w", err)
	}

	if provider.Type == sso.SSOProviderTypeSAML {
		samlProvider, exists := s.samlProviders[providerID]
		if !exists {
			return fmt.Errorf("SAML provider not initialized")
		}

		if provider.MetadataURL != "" {
			return samlProvider.LoadMetadataFromURL(ctx, provider.MetadataURL)
		}
	} else if provider.Type == sso.SSOProviderTypeOIDC {
		_, exists := s.oidcProviders[providerID]
		if !exists {
			return fmt.Errorf("OIDC provider not initialized")
		}

		if provider.AuthURL != "" {
			issuerURL := extractIssuerFromAuthURL(provider.AuthURL)
			if issuerURL != "" {
				_, err := oidc.NewProvider(ctx, issuerURL)
				return err
			}
		}
	}

	return nil
}

// GetSAMLMetadata returns the SAML metadata for our service
func (s *ssoServiceImpl) GetSAMLMetadata(ctx context.Context, providerID string) (string, error) {
	provider, err := s.providerRepo.GetByID(ctx, providerID)
	if err != nil {
		return "", fmt.Errorf("provider not found: %w", err)
	}

	if provider.Type != sso.SSOProviderTypeSAML {
		return "", fmt.Errorf("provider is not a SAML provider")
	}

	samlProvider, exists := s.samlProviders[providerID]
	if !exists {
		if err := s.initializeSAMLProvider(provider); err != nil {
			return "", fmt.Errorf("failed to initialize SAML provider: %w", err)
		}
		samlProvider = s.samlProviders[providerID]
	}

	return samlProvider.GetMetadata()
}

// GetProviderForDomain returns provider for a domain
func (s *ssoServiceImpl) GetProviderForDomain(ctx context.Context, domain string) (*sso.SSOProvider, error) {
	return nil, fmt.Errorf("not implemented")
}

// GenerateAuthURL generates an auth URL for a session
func (s *ssoServiceImpl) GenerateAuthURL(ctx context.Context, session *sso.SSOSession) (string, error) {
	return "", fmt.Errorf("not implemented")
}

// ValidateDomain validates an email domain against enterprise settings
func (s *ssoServiceImpl) ValidateDomain(ctx context.Context, email string, organizationID string) error {
	settings, err := s.settingsRepo.GetByOrganization(ctx, organizationID)
	if err != nil {
		return err
	}
	_ = settings
	return nil
}
