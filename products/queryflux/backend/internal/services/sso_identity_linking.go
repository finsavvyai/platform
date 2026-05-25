package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/sso"
)

// InitiateSAMLLogin initiates a SAML SSO login flow
func (s *ssoServiceImpl) InitiateSAMLLogin(
	ctx context.Context,
	providerID, redirectURL string,
) (*sso.SSOSession, string, error) {
	provider, err := s.providerRepo.GetByID(ctx, providerID)
	if err != nil {
		return nil, "", fmt.Errorf("provider not found: %w", err)
	}

	if provider.Type != sso.SSOProviderTypeSAML {
		return nil, "", fmt.Errorf("provider is not a SAML provider")
	}

	samlProvider, exists := s.samlProviders[providerID]
	if !exists {
		if err := s.initializeSAMLProvider(provider); err != nil {
			return nil, "", fmt.Errorf("failed to initialize SAML provider: %w", err)
		}
		samlProvider = s.samlProviders[providerID]
	}

	expiresAt := time.Now().Add(time.Duration(s.config.SessionTTL) * time.Minute)
	session, err := sso.NewSSOSession("", redirectURL, expiresAt)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create session: %w", err)
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to save session: %w", err)
	}

	authURL, err := samlProvider.GenerateAuthRequest(session)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate auth URL: %w", err)
	}

	return session, authURL, nil
}

// ProcessSAMLResponse processes a SAML response from the IdP
func (s *ssoServiceImpl) ProcessSAMLResponse(
	ctx context.Context,
	requestID, samlResponse string,
) (*entities.User, string, error) {
	session, err := s.sessionRepo.GetByRequestID(ctx, requestID)
	if err != nil {
		return nil, "", fmt.Errorf("session not found: %w", err)
	}

	if err := session.Validate(); err != nil {
		return nil, "", fmt.Errorf("invalid session: %w", err)
	}

	if session.IdentityID == nil {
		return nil, "", fmt.Errorf("session has no associated identity")
	}
	identity, err := s.identityRepo.GetByID(ctx, *session.IdentityID)
	if err != nil {
		return nil, "", fmt.Errorf("identity not found: %w", err)
	}

	provider, err := s.providerRepo.GetByID(ctx, identity.ProviderID)
	if err != nil {
		return nil, "", fmt.Errorf("provider not found: %w", err)
	}

	samlProvider, exists := s.samlProviders[provider.ID]
	if !exists {
		return nil, "", fmt.Errorf("SAML provider not initialized")
	}

	response, err := samlProvider.ProcessResponse(samlResponse)
	if err != nil {
		return nil, "", fmt.Errorf("failed to process SAML response: %w", err)
	}

	identity.Name = response.NameID
	for key, value := range response.Attributes {
		identity.SetAttribute(key, value)
	}

	if email, exists := response.Attributes["email"]; exists {
		identity.Email = email
	} else if email, exists := response.Attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]; exists {
		identity.Email = email
	}

	user, err := s.provisioningService.ProvisionUser(ctx, identity, provider)
	if err != nil {
		return nil, "", fmt.Errorf("failed to provision user: %w", err)
	}

	token, err := s.generateJWTToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	session.Deactivate()
	s.sessionRepo.Update(ctx, session)

	return user, token, nil
}

// InitiateOIDCLogin initiates an OIDC SSO login flow
func (s *ssoServiceImpl) InitiateOIDCLogin(
	ctx context.Context,
	providerID, redirectURL string,
) (*sso.SSOSession, string, error) {
	provider, err := s.providerRepo.GetByID(ctx, providerID)
	if err != nil {
		return nil, "", fmt.Errorf("provider not found: %w", err)
	}

	if provider.Type != sso.SSOProviderTypeOIDC {
		return nil, "", fmt.Errorf("provider is not an OIDC provider")
	}

	oidcProvider, exists := s.oidcProviders[providerID]
	if !exists {
		if err := s.initializeOIDCProvider(provider); err != nil {
			return nil, "", fmt.Errorf("failed to initialize OIDC provider: %w", err)
		}
		oidcProvider = s.oidcProviders[providerID]
	}

	expiresAt := time.Now().Add(time.Duration(s.config.SessionTTL) * time.Minute)
	session, err := sso.NewSSOSession("", redirectURL, expiresAt)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create session: %w", err)
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", fmt.Errorf("failed to save session: %w", err)
	}

	authURL, err := oidcProvider.GenerateAuthURL(session)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate auth URL: %w", err)
	}

	return session, authURL, nil
}

// RefreshOIDCToken refreshes an OIDC token
func (s *ssoServiceImpl) RefreshOIDCToken(ctx context.Context, identityID string) error {
	identity, err := s.identityRepo.GetByID(ctx, identityID)
	if err != nil {
		return fmt.Errorf("identity not found: %w", err)
	}

	refreshToken, exists := identity.GetAttribute("refresh_token")
	if !exists {
		return fmt.Errorf("no refresh token available")
	}

	provider, err := s.providerRepo.GetByID(ctx, identity.ProviderID)
	if err != nil {
		return fmt.Errorf("provider not found: %w", err)
	}

	oidcProvider, exists := s.oidcProviders[provider.ID]
	if !exists {
		if err := s.initializeOIDCProvider(provider); err != nil {
			return fmt.Errorf("failed to initialize OIDC provider: %w", err)
		}
		oidcProvider = s.oidcProviders[provider.ID]
	}

	newTokenResponse, err := oidcProvider.RefreshAccessToken(ctx, refreshToken.(string))
	if err != nil {
		return fmt.Errorf("failed to refresh token: %w", err)
	}

	identity.SetAttribute("access_token", newTokenResponse.AccessToken)
	if newTokenResponse.RefreshToken != "" {
		identity.SetAttribute("refresh_token", newTokenResponse.RefreshToken)
	}

	return s.identityRepo.Update(ctx, identity)
}
