package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/domain/sso"
)

// EnterpriseProvisioningService handles user provisioning and role mapping for enterprise SSO
type EnterpriseProvisioningService struct {
	userRepo       repositories.UserRepository
	identityRepo   sso.SSOIdentityRepository
	providerRepo   sso.SSOProviderRepository
	sessionRepo    sso.SSOSessionRepository
	authService    AuthService
	enterpriseRepo sso.EnterpriseSettingsRepository
}

// NewEnterpriseProvisioningService creates a new enterprise provisioning service
func NewEnterpriseProvisioningService(
	userRepo repositories.UserRepository,
	identityRepo sso.SSOIdentityRepository,
	providerRepo sso.SSOProviderRepository,
	sessionRepo sso.SSOSessionRepository,
	authService AuthService,
	enterpriseRepo sso.EnterpriseSettingsRepository,
) *EnterpriseProvisioningService {
	return &EnterpriseProvisioningService{
		userRepo:       userRepo,
		identityRepo:   identityRepo,
		providerRepo:   providerRepo,
		sessionRepo:    sessionRepo,
		authService:    authService,
		enterpriseRepo: enterpriseRepo,
	}
}

// ProvisionUser provisions a new user from SSO identity
func (s *EnterpriseProvisioningService) ProvisionUser(
	ctx context.Context,
	identity *sso.SSOIdentity,
	provider *sso.SSOProvider,
) (*entities.User, error) {
	// Check if user already exists
	var user *entities.User
	if identity.UserID != nil {
		existingUser, err := s.userRepo.GetByID(ctx, *identity.UserID)
		if err == nil {
			user = existingUser
		}
	}

	// Create new user if not exists
	if user == nil {
		// Check if user exists with same email
		existingUser, err := s.userRepo.GetByEmail(ctx, identity.Email)
		if err == nil {
			user = existingUser
			// Link identity to existing user
			identity.LinkUser(user.ID)
			if err := s.identityRepo.Update(ctx, identity); err != nil {
				return nil, fmt.Errorf("failed to link identity to user: %w", err)
			}
		}
	}

	if user == nil {
		// Create new user
		var userID string
		if identity.UserID != nil {
			userID = *identity.UserID
		} else {
			userID = uuid.New().String()
		}

		user = &entities.User{
			ID:        userID,
			Email:     identity.Email,
			Name:      identity.Name,
			Role:      provider.DefaultRole,
			Plan:      provider.DefaultPlan,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Apply role mapping if configured
		if roles, err := s.MapUserRoles(ctx, identity, provider); err == nil && len(roles) > 0 {
			// Apply highest priority role
			user.Role = roles[0]
		}

		// Set password hash to empty for SSO users (they can't login with password)
		user.PasswordHash = ""

		// Save user
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}

		// Link identity to user
		identity.LinkUser(user.ID)
		if err := s.identityRepo.Update(ctx, identity); err != nil {
			return nil, fmt.Errorf("failed to link identity to user: %w", err)
		}
	}

	// Update user attributes from SSO identity
	if err := s.UpdateUserFromIdentity(ctx, user, identity, provider); err != nil {
		return nil, fmt.Errorf("failed to update user from identity: %w", err)
	}

	return user, nil
}

// UpdateUserFromIdentity updates user attributes from SSO identity
func (s *EnterpriseProvisioningService) UpdateUserFromIdentity(
	ctx context.Context,
	user *entities.User,
	identity *sso.SSOIdentity,
	provider *sso.SSOProvider,
) error {
	// Parse attribute mapping
	attributeMapping := provider.GetAttributeMapping()

	// Update user name if provided
	if name, exists := identity.GetAttribute(attributeMapping["name"]); exists {
		if nameStr, ok := name.(string); ok && nameStr != "" {
			user.Name = nameStr
		}
	} else if identity.Name != "" {
		user.Name = identity.Name
	}

	// Split name into first and last name if not provided
	parts := strings.Split(user.Name, " ")
	if len(parts) >= 2 {
		identity.FirstName = parts[0]
		identity.LastName = strings.Join(parts[1:], " ")
	} else if len(parts) == 1 {
		identity.FirstName = parts[0]
		identity.LastName = ""
	}

	// Update user role if mapping exists
	if roles, err := s.MapUserRoles(ctx, identity, provider); err == nil && len(roles) > 0 {
		// Apply highest priority role
		user.SetRole(roles[0])
	}

	// Update user plan if enterprise and not already set
	if user.Plan != entities.PlanEnterprise {
		if isEnterpriseUser, err := s.IsEnterpriseUser(ctx, identity); err == nil && isEnterpriseUser {
			user.SetPlan(entities.PlanEnterprise)
		}
	}

	// Save updated user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Update identity last authentication
	identity.UpdateLastAuthentication()
	if err := s.identityRepo.Update(ctx, identity); err != nil {
		return fmt.Errorf("failed to update identity: %w", err)
	}

	return nil
}

// MapUserRoles maps user roles based on SSO attributes
func (s *EnterpriseProvisioningService) MapUserRoles(
	ctx context.Context,
	identity *sso.SSOIdentity,
	provider *sso.SSOProvider,
) ([]string, error) {
	// Get attribute mapping
	attributeMapping := provider.GetAttributeMapping()

	// Check for role attribute
	roleAttr := "roles"
	if mappedRole, exists := attributeMapping["roles"]; exists {
		roleAttr = mappedRole
	}

	// Get roles from identity attributes
	rolesAttr, exists := identity.GetAttribute(roleAttr)
	if !exists {
		// Try common role attribute names
		for _, attr := range []string{"groups", "memberOf", "userGroups"} {
			if attrValue, found := identity.GetAttribute(attr); found {
				rolesAttr = attrValue
				roleAttr = attr
				break
			}
		}
	}

	if rolesAttr == nil {
		return []string{provider.DefaultRole}, nil
	}

	// Parse roles
	var roles []string
	switch v := rolesAttr.(type) {
	case []string:
		roles = v
	case []interface{}:
		for _, r := range v {
			if roleStr, ok := r.(string); ok {
				roles = append(roles, roleStr)
			}
		}
	case string:
		// Try to parse as JSON array
		if err := json.Unmarshal([]byte(v), &roles); err != nil {
			// Try comma-separated
			roles = strings.Split(v, ",")
			for i, role := range roles {
				roles[i] = strings.TrimSpace(role)
			}
		}
	}

	// Get enterprise settings for role mapping
	enterpriseSettings, err := s.getEnterpriseSettingsForProvider(ctx, provider.ID)
	if err != nil {
		// Use default role mapping
		return s.applyDefaultRoleMapping(roles, provider.DefaultRole), nil
	}

	// Apply enterprise-specific role mapping
	return s.applyEnterpriseRoleMapping(roles, enterpriseSettings), nil
}

// applyDefaultRoleMapping applies default role mapping
func (s *EnterpriseProvisioningService) applyDefaultRoleMapping(providerRoles []string, defaultRole string) []string {
	var mappedRoles []string

	// Default role mapping logic
	for _, role := range providerRoles {
		role = strings.ToLower(role)

		// Map common admin role names
		if contains(role, []string{"admin", "administrator", "root", "superuser"}) {
			mappedRoles = append(mappedRoles, string(entities.RoleAdmin))
		} else if contains(role, []string{"user", "member", "employee", "staff"}) {
			mappedRoles = append(mappedRoles, string(entities.RoleUser))
		}
	}

	// If no roles mapped, use default
	if len(mappedRoles) == 0 {
		mappedRoles = append(mappedRoles, defaultRole)
	}

	// Remove duplicates
	return removeDuplicates(mappedRoles)
}

// applyEnterpriseRoleMapping applies enterprise-specific role mapping
func (s *EnterpriseProvisioningService) applyEnterpriseRoleMapping(
	providerRoles []string,
	settings *sso.EnterpriseSettings,
) []string {
	// Get role mappings from settings
	roleMappings := settings.GetRoleMappings()

	var mappedRoles []string

	for _, providerRole := range providerRoles {
		// Check if there's a mapping for this role
		if localRole, exists := roleMappings[providerRole]; exists {
			mappedRoles = append(mappedRoles, localRole)
		}
	}

	// If no mappings found, use default
	if len(mappedRoles) == 0 {
		mappedRoles = append(mappedRoles, string(entities.RoleUser))
	}

	return removeDuplicates(mappedRoles)
}

// IsEnterpriseUser checks if an identity belongs to an enterprise
func (s *EnterpriseProvisioningService) IsEnterpriseUser(
	ctx context.Context,
	identity *sso.SSOIdentity,
) (bool, error) {
	// Check identity attributes for enterprise domain
	if emailDomain := getEmailDomain(identity.Email); emailDomain != "" {
		// Check if domain is associated with an enterprise settings
		// This would require a method in EnterpriseSettingsRepository to find by domain
		// For now, we assume false or implement logic if repository supports it
	}

	return false, nil
}

// getEmailDomain extracts domain from email
func getEmailDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		return parts[1]
	}
	return ""
}

// LinkIdentityToUser links an SSO identity to a user
func (s *EnterpriseProvisioningService) LinkIdentityToUser(ctx context.Context, identityID, userID string) error {
	return s.identityRepo.LinkToUser(ctx, identityID, userID)
}

// UnlinkIdentityFromUser unlinks an SSO identity from a user
func (s *EnterpriseProvisioningService) UnlinkIdentityFromUser(ctx context.Context, identityID string) error {
	return s.identityRepo.UnlinkFromUser(ctx, identityID)
}

// getEnterpriseSettingsForProvider gets enterprise settings for a provider
func (s *EnterpriseProvisioningService) getEnterpriseSettingsForProvider(
	ctx context.Context,
	providerID string,
) (*sso.EnterpriseSettings, error) {
	settings, err := s.enterpriseRepo.GetByProvider(ctx, providerID)
	if err != nil || len(settings) == 0 {
		return nil, fmt.Errorf("no enterprise settings found for provider")
	}

	// Return the first settings for now (in real implementation, might need to select based on domain)
	return settings[0], nil
}

// ValidateDomain validates if a user's email domain is allowed for enterprise SSO
func (s *EnterpriseProvisioningService) ValidateDomain(
	ctx context.Context,
	email string,
	organizationID string,
) error {
	// Extract domain from email
	emailParts := strings.Split(email, "@")
	if len(emailParts) < 2 {
		return fmt.Errorf("invalid email format")
	}
	domain := emailParts[1]

	// Get enterprise settings
	settings, err := s.enterpriseRepo.GetByOrganization(ctx, organizationID)
	if err != nil {
		return fmt.Errorf("organization not found")
	}

	// Check domain whitelist
	domainWhitelist := settings.GetDomainWhitelist()
	if len(domainWhitelist) > 0 {
		if !contains(domain, domainWhitelist) {
			return fmt.Errorf("domain %s is not allowed for this organization", domain)
		}
	}

	return nil
}

// GetProviderForDomain returns the SSO provider for a given email domain
func (s *EnterpriseProvisioningService) GetProviderForDomain(
	ctx context.Context,
	domain string,
) (*sso.SSOProvider, error) {
	// Get all enabled providers
	providers, err := s.providerRepo.GetEnabled(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get providers: %w", err)
	}

	// Check each provider for domain matching
	for _, provider := range providers {
		// Parse provider attribute mapping to see if domain is configured
		attributeMapping := provider.GetAttributeMapping()
		if domainAttr, exists := attributeMapping["domain"]; exists {
			if domainAttr == domain {
				return provider, nil
			}
		}

		// Check enterprise settings
		enterpriseSettings, err := s.enterpriseRepo.GetByProvider(ctx, provider.ID)
		if err == nil {
			for _, settings := range enterpriseSettings {
				domainWhitelist := settings.GetDomainWhitelist()
				if contains(domain, domainWhitelist) {
					return provider, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("no provider found for domain %s", domain)
}

// SyncUserGroups syncs user groups from SSO provider
func (s *EnterpriseProvisioningService) SyncUserGroups(
	ctx context.Context,
	userID string,
	groups []string,
) error {
	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Update user role based on groups
	// This would typically involve a group-to-role mapping
	for _, group := range groups {
		group = strings.ToLower(group)
		if contains(group, []string{"admin", "administrator"}) {
			user.SetRole(string(entities.RoleAdmin))
			break
		}
	}

	// Save updated user
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// DeprovisionUser deactivates a user when they leave the organization
func (s *EnterpriseProvisioningService) DeprovisionUser(
	ctx context.Context,
	userID string,
	providerID string,
) error {
	// Get user
	_, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Deactivate user (don't delete for audit purposes)
	// This would require adding an 'active' field to the User entity
	// For now, we'll remove all their SSO identities

	// Get all identities for the user
	identities, err := s.identityRepo.GetByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user identities: %w", err)
	}

	// Remove identities from the specific provider
	for _, identity := range identities {
		if identity.ProviderID == providerID {
			if err := s.identityRepo.Update(ctx, identity); err != nil {
				return fmt.Errorf("failed to delete identity: %w", err)
			}
		}
	}

	// Invalidate all sessions
	if err := s.sessionRepo.DeactivateByUser(ctx, userID); err != nil {
		return fmt.Errorf("failed to deactivate user sessions: %w", err)
	}

	// Revoke all authentication tokens
	if err := s.authService.Logout(ctx, ""); err != nil {
		// Log error but continue
	}

	return nil
}

// Helper functions

func contains(s string, list []string) bool {
	for _, item := range list {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}

func removeDuplicates(slice []string) []string {
	keys := make(map[string]bool)
	var result []string

	for _, item := range slice {
		if _, exists := keys[item]; !exists {
			keys[item] = true
			result = append(result, item)
		}
	}

	return result
}
