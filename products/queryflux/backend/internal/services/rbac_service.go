package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// RBACService handles role-based access control
type RBACService struct {
	userRepo  repositories.UserRepository
	teamRepo  repositories.TeamRepository
	auditRepo repositories.AuditRepository
}

// NewRBACService creates a new RBAC service
func NewRBACService(
	userRepo repositories.UserRepository,
	teamRepo repositories.TeamRepository,
	auditRepo repositories.AuditRepository,
) *RBACService {
	return &RBACService{
		userRepo:  userRepo,
		teamRepo:  teamRepo,
		auditRepo: auditRepo,
	}
}

// CheckPermission checks if a user has a specific permission
func (s *RBACService) CheckPermission(ctx context.Context, userID string, permission entities.Permission) (bool, error) {
	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Check role-based permissions
	rolePermissions := entities.DefaultRolePermissions[entities.Role(user.Role)]
	for _, p := range rolePermissions {
		if p == permission {
			return true, nil
		}
	}

	return false, nil
}

// CheckResourcePermission checks if a user has permission for a specific resource
func (s *RBACService) CheckResourcePermission(ctx context.Context, userID, resourceID string, resourceType entities.ResourceType, permission entities.Permission) (bool, error) {
	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Owner has all permissions
	if user.Role == string(entities.RoleOwner) {
		return true, nil
	}

	// Check role-based permissions first
	rolePermissions := entities.DefaultRolePermissions[entities.Role(user.Role)]
	hasRolePermission := false
	for _, p := range rolePermissions {
		if p == permission {
			hasRolePermission = true
			break
		}
	}

	if !hasRolePermission {
		return false, nil
	}

	// For resource-specific permissions, additional checks would be needed
	// This would involve checking UserPermission and TeamPermission tables
	// For now, we implement the basic role-based check

	return true, nil
}

// CheckTeamPermission checks if a user has permission within a team context
func (s *RBACService) CheckTeamPermission(ctx context.Context, userID, teamID string, permission entities.Permission) (bool, error) {
	// Check if user is a member of the team
	isMember, err := s.teamRepo.IsMember(ctx, teamID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check team membership: %w", err)
	}

	if !isMember {
		return false, nil
	}

	// Get user's role in the team
	teamRole, err := s.teamRepo.GetMemberRole(ctx, teamID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get team role: %w", err)
	}

	// Map team role to permissions
	role := entities.Role(teamRole)
	rolePermissions := entities.DefaultRolePermissions[role]

	for _, p := range rolePermissions {
		if p == permission {
			return true, nil
		}
	}

	return false, nil
}

// GetUserPermissions returns all permissions for a user
func (s *RBACService) GetUserPermissions(ctx context.Context, userID string) (map[entities.Permission]bool, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	permissions := make(map[entities.Permission]bool)

	// Get role-based permissions
	rolePermissions := entities.DefaultRolePermissions[entities.Role(user.Role)]
	for _, p := range rolePermissions {
		permissions[p] = true
	}

	// TODO: Add custom user permissions and team permissions

	return permissions, nil
}

// HasMinimumRole checks if a user has at least the minimum role level
func (s *RBACService) HasMinimumRole(ctx context.Context, userID string, minimumRole entities.Role) (bool, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	return entities.Role(user.Role).HasMinimumAccess(minimumRole), nil
}

// GrantPermission grants a permission to a user for a specific resource
func (s *RBACService) GrantPermission(ctx context.Context, userID, resourceID string, resourceType entities.ResourceType, permission entities.Permission, grantedBy string, expiresAt *time.Time) error {
	// Check if granter has admin permissions
	hasPermission, err := s.CheckPermission(ctx, grantedBy, entities.PermissionAdminManage)
	if err != nil {
		return fmt.Errorf("failed to check granter permissions: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("user does not have permission to grant permissions")
	}

	// TODO: Implement UserPermission repository and create permission record
	// For now, this is a placeholder

	// Log the permission grant
	audit := entities.NewAuditLog(grantedBy, "grant", string(resourceType), resourceID, "", "")
	audit.WithTeam(userID).WithDetails(fmt.Sprintf("Granted permission: %s", permission))
	if err := s.auditRepo.Log(ctx, audit); err != nil {
		// Log error but don't fail the operation
	}

	return nil
}

// RevokePermission revokes a permission from a user
func (s *RBACService) RevokePermission(ctx context.Context, userID, resourceID string, resourceType entities.ResourceType, permission entities.Permission, revokedBy string) error {
	// Check if revoker has admin permissions
	hasPermission, err := s.CheckPermission(ctx, revokedBy, entities.PermissionAdminManage)
	if err != nil {
		return fmt.Errorf("failed to check revoker permissions: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("user does not have permission to revoke permissions")
	}

	// TODO: Implement permission revocation
	// For now, this is a placeholder

	// Log the permission revocation
	audit := entities.NewAuditLog(revokedBy, "revoke", string(resourceType), resourceID, "", "")
	audit.WithTeam(userID).WithDetails(fmt.Sprintf("Revoked permission: %s", permission))
	if err := s.auditRepo.Log(ctx, audit); err != nil {
		// Log error but don't fail the operation
	}

	return nil
}

// SetUserRole sets a user's role
func (s *RBACService) SetUserRole(ctx context.Context, userID string, role entities.Role, changedBy string) error {
	// Check if changer has admin permissions
	hasPermission, err := s.CheckPermission(ctx, changedBy, entities.PermissionAdminManage)
	if err != nil {
		return fmt.Errorf("failed to check changer permissions: %w", err)
	}

	if !hasPermission {
		return fmt.Errorf("user does not have permission to change roles")
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Update role
	user.Role = string(role)
	user.UpdatedAt = time.Now()

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user role: %w", err)
	}

	// Log the role change
	audit := entities.NewAuditLog(changedBy, "update", "user", userID, "", "")
	audit.WithDetails(fmt.Sprintf("Changed role to: %s", role))
	if err := s.auditRepo.Log(ctx, audit); err != nil {
		// Log error but don't fail the operation
	}

	return nil
}

// GetUsersByRole retrieves all users with a specific role
func (s *RBACService) GetUsersByRole(ctx context.Context, role entities.Role, limit, offset int) ([]*entities.User, error) {
	return s.userRepo.GetByRole(ctx, string(role), limit, offset)
}

// CanAccessResource checks if a user can access a specific resource
func (s *RBACService) CanAccessResource(ctx context.Context, userID, resourceID string, resourceType entities.ResourceType) (bool, error) {
	// This is a simplified version - in production, you'd check:
	// 1. User's global role
	// 2. User-specific permissions for this resource
	// 3. Team permissions if the resource belongs to a team
	// 4. Resource ownership

	// For now, just check if user has read permission for this resource type
	var permission entities.Permission
	switch resourceType {
	case entities.ResourceTypeUser:
		permission = entities.PermissionUserRead
	case entities.ResourceTypeConnection:
		permission = entities.PermissionConnectionRead
	case entities.ResourceTypeQuery:
		permission = entities.PermissionQueryRead
	case entities.ResourceTypeTeam:
		permission = entities.PermissionTeamRead
	case entities.ResourceTypeProject:
		permission = entities.PermissionProjectRead
	default:
		return false, nil
	}

	return s.CheckPermission(ctx, userID, permission)
}

// ValidateAccess validates access and returns an error if access is denied
func (s *RBACService) ValidateAccess(ctx context.Context, userID string, permission entities.Permission) error {
	hasAccess, err := s.CheckPermission(ctx, userID, permission)
	if err != nil {
		return fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasAccess {
		return fmt.Errorf("access denied: missing permission %s", permission)
	}

	return nil
}

// ValidateResourceAccess validates resource access and returns an error if denied
func (s *RBACService) ValidateResourceAccess(ctx context.Context, userID, resourceID string, resourceType entities.ResourceType, permission entities.Permission) error {
	hasAccess, err := s.CheckResourcePermission(ctx, userID, resourceID, resourceType, permission)
	if err != nil {
		return fmt.Errorf("failed to check resource permission: %w", err)
	}

	if !hasAccess {
		return fmt.Errorf("access denied: missing permission %s for resource %s", permission, resourceID)
	}

	return nil
}

// AuditPermissionCheck logs a permission check for audit purposes
func (s *RBACService) AuditPermissionCheck(ctx context.Context, userID string, permission entities.Permission, resourceID string, resourceType entities.ResourceType, granted bool, ipAddress, userAgent string) error {
	audit := entities.NewAuditLog(userID, "permission_check", string(resourceType), resourceID, ipAddress, userAgent)
	audit.WithDetails(fmt.Sprintf("Permission: %s, Granted: %t", permission, granted))
	if !granted {
		audit.WithError("Access denied")
	}

	return s.auditRepo.Log(ctx, audit)
}

// GetUserRole returns the role of a user
func (s *RBACService) GetUserRole(ctx context.Context, userID string) (entities.Role, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get user: %w", err)
	}

	return entities.Role(user.Role), nil
}

// IsAdmin checks if a user has admin role or higher
func (s *RBACService) IsAdmin(ctx context.Context, userID string) (bool, error) {
	return s.HasMinimumRole(ctx, userID, entities.RoleAdmin)
}

// IsOwner checks if a user has owner role
func (s *RBACService) IsOwner(ctx context.Context, userID string) (bool, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	return user.Role == string(entities.RoleOwner), nil
}
