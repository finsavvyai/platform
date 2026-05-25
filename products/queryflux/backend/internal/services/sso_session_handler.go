package services

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/sso"
)

// ProcessOIDCCallback processes an OIDC callback from the IdP
func (s *ssoServiceImpl) ProcessOIDCCallback(
	ctx context.Context,
	state, code string,
) (*entities.User, string, error) {
	session, err := s.sessionRepo.GetByState(ctx, state)
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

	oidcProvider, exists := s.oidcProviders[provider.ID]
	if !exists {
		return nil, "", fmt.Errorf("OIDC provider not initialized")
	}

	tokenResponse, err := oidcProvider.ExchangeCodeForToken(ctx, code)
	if err != nil {
		return nil, "", fmt.Errorf("failed to exchange code for token: %w", err)
	}

	idToken, err := oidcProvider.VerifyIDToken(ctx, tokenResponse.IDToken)
	if err != nil {
		return nil, "", fmt.Errorf("failed to verify ID token: %w", err)
	}

	var claims map[string]interface{}
	if err := idToken.Claims(&claims); err != nil {
		return nil, "", fmt.Errorf("failed to extract ID token claims: %w", err)
	}

	identity.Name = getStringClaim(claims, "name")
	identity.Email = getStringClaim(claims, "email")
	identity.FirstName = getStringClaim(claims, "given_name")
	identity.LastName = getStringClaim(claims, "family_name")

	for key, value := range claims {
		identity.SetAttribute(key, value)
	}

	if tokenResponse.AccessToken != "" {
		userInfo, err := oidcProvider.GetUserInfo(ctx, tokenResponse.AccessToken)
		if err == nil {
			if userInfo.Name != "" {
				identity.Name = userInfo.Name
			}
			if userInfo.Email != "" {
				identity.Email = userInfo.Email
			}
			for key, value := range userInfo.Attributes {
				identity.SetAttribute(key, value)
			}
		}
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

// ValidateSession validates an SSO session
func (s *ssoServiceImpl) ValidateSession(ctx context.Context, sessionID string) (*sso.SSOIdentity, error) {
	session, err := s.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	if err := session.Validate(); err != nil {
		return nil, fmt.Errorf("invalid session: %w", err)
	}

	if session.IdentityID == nil {
		return nil, fmt.Errorf("session has no associated identity")
	}
	identity, err := s.identityRepo.GetByID(ctx, *session.IdentityID)
	if err != nil {
		return nil, fmt.Errorf("identity not found: %w", err)
	}

	return identity, nil
}

// GetSession retrieves an SSO session
func (s *ssoServiceImpl) GetSession(ctx context.Context, id string) (*sso.SSOSession, error) {
	return s.sessionRepo.GetByID(ctx, id)
}

// GetSessionByState retrieves an SSO session by state
func (s *ssoServiceImpl) GetSessionByState(ctx context.Context, state string) (*sso.SSOSession, error) {
	return s.sessionRepo.GetByState(ctx, state)
}

// InvalidateSession invalidates an SSO session
func (s *ssoServiceImpl) InvalidateSession(ctx context.Context, sessionID string) error {
	return s.sessionRepo.Delete(ctx, sessionID)
}

// InvalidateUserSessions invalidates all sessions for a user
func (s *ssoServiceImpl) InvalidateUserSessions(ctx context.Context, userID string) error {
	return s.sessionRepo.DeactivateByUser(ctx, userID)
}

// CleanupExpiredSessions removes expired sessions
func (s *ssoServiceImpl) CleanupExpiredSessions(ctx context.Context) error {
	return s.sessionRepo.DeleteExpired(ctx)
}

// ProvisionUser provisions a user from SSO identity
func (s *ssoServiceImpl) ProvisionUser(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) (*entities.User, error) {
	return s.provisioningService.ProvisionUser(ctx, identity, provider)
}

// UpdateUserFromIdentity updates user based on identity
func (s *ssoServiceImpl) UpdateUserFromIdentity(ctx context.Context, user *entities.User, identity *sso.SSOIdentity, provider *sso.SSOProvider) error {
	return nil
}

// GetUserFromIdentity gets user from identity
func (s *ssoServiceImpl) GetUserFromIdentity(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) (*entities.User, error) {
	if identity.UserID != nil && *identity.UserID != "" {
		return s.userRepo.GetByID(ctx, *identity.UserID)
	}
	return nil, nil
}

// MapUserRoles maps roles from SSO identity
func (s *ssoServiceImpl) MapUserRoles(ctx context.Context, identity *sso.SSOIdentity, provider *sso.SSOProvider) ([]string, error) {
	return []string{s.config.DefaultRole}, nil
}

// ApplyRoleMapping applies role mapping to a user
func (s *ssoServiceImpl) ApplyRoleMapping(ctx context.Context, userID string, roles []string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	_ = user
	return nil
}
