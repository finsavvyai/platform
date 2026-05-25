//go:build experimental_services

/**
 * Team Management Service
 *
 * Handles team creation, member management, and collaboration
 */

package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// TeamManagementService handles team operations
type TeamManagementService struct {
	teamRepo    TeamRepository
	userRepo    UserRepository
	queryRepo   QueryRepository
	auditLogger AuditLogger
	logger      *zap.Logger
	mu          sync.RWMutex
}

// TeamRepository defines the interface for team data persistence
type TeamRepository interface {
	Create(ctx context.Context, team *Team) error
	FindByID(ctx context.Context, teamID string) (*Team, error)
	FindByOwner(ctx context.Context, ownerID string) ([]*Team, error)
	Update(ctx context.Context, team *Team) error
	Delete(ctx context.Context, teamID string) error
	AddMember(ctx context.Context, teamID string, member *TeamMember) error
	RemoveMember(ctx context.Context, teamID string, userID string) error
	UpdateMemberRole(ctx context.Context, teamID string, userID string, role TeamRole) error
	FindMembers(ctx context.Context, teamID string) ([]*TeamMember, error)
	FindByInvitationToken(ctx context.Context, token string) (*Team, error)
}

// AuditLogger defines the interface for audit logging
type AuditLogger interface {
	Log(ctx context.Context, entry *AuditEntry) error
}

// Team represents a collaboration team
type Team struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Slug        string       `json:"slug"`
	Description string       `json:"description,omitempty"`
	OwnerID     string       `json:"ownerId"`
	Settings    TeamSettings `json:"settings"`
	CreatedAt   time.Time    `json:"createdAt"`
	UpdatedAt   time.Time    `json:"updatedAt"`
}

// TeamSettings represents team configuration
type TeamSettings struct {
	MaxMembers        int           `json:"maxMembers"`
	DefaultRole       TeamRole      `json:"defaultRole"`
	SharingEnabled    bool          `json:"sharingEnabled"`
	ActivityRetention time.Duration `json:"activityRetention"`
	RequireApproval   bool          `json:"requireApproval"`
}

// TeamMember represents a team member
type TeamMember struct {
	UserID     string       `json:"userId"`
	TeamID     string       `json:"teamId"`
	Role       TeamRole     `json:"role"`
	JoinedAt   time.Time    `json:"joinedAt"`
	InvitedBy  string       `json:"invitedBy"`
	Status     MemberStatus `json:"status"`
	LastActive time.Time    `json:"lastActive"`
}

// TeamRole represents a member's role in a team
type TeamRole string

const (
	RoleOwner     TeamRole = "owner"
	RoleAdmin     TeamRole = "admin"
	RoleDeveloper TeamRole = "developer"
	RoleViewer    TeamRole = "viewer"
	RoleGuest     TeamRole = "guest"
)

// MemberStatus represents a member's status
type MemberStatus string

const (
	StatusActive    MemberStatus = "active"
	StatusPending   MemberStatus = "pending"
	StatusInactive  MemberStatus = "inactive"
	StatusSuspended MemberStatus = "inactive"
)

// TeamInvitation represents an invitation to join a team
type TeamInvitation struct {
	ID         string     `json:"id"`
	TeamID     string     `json:"teamId"`
	InvitedBy  string     `json:"invitedBy"`
	Email      string     `json:"email"`
	Role       TeamRole   `json:"role"`
	Token      string     `json:"token"`
	ExpiresAt  time.Time  `json:"expiresAt"`
	AcceptedAt *time.Time `json:"acceptedAt,omitempty"`
	DeclinedAt *time.Time `json:"declinedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// TeamActivity represents an activity log entry
type TeamActivity struct {
	ID        string                 `json:"id"`
	TeamID    string                 `json:"teamId"`
	UserID    string                 `json:"userId"`
	Action    string                 `json:"action"`
	Details   map[string]interface{} `json:"details"`
	CreatedAt time.Time              `json:"createdAt"`
}

// AuditEntry represents an audit log entry
type AuditEntry struct {
	ID        string                 `json:"id"`
	TeamID    string                 `json:"teamId"`
	UserID    string                 `json:"userId"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Details   map[string]interface{} `json:"details"`
	Timestamp time.Time              `json:"timestamp"`
	IPAddress string                 `json:"ipAddress,omitempty"`
	UserAgent string                 `json:"userAgent,omitempty"`
}

// CreateTeamRequest represents a request to create a team
type CreateTeamRequest struct {
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	OwnerID     string        `json:"ownerId"`
	Settings    *TeamSettings `json:"settings,omitempty"`
}

// UpdateTeamRequest represents a request to update a team
type UpdateTeamRequest struct {
	Name        *string       `json:"name,omitempty"`
	Description *string       `json:"description,omitempty"`
	Settings    *TeamSettings `json:"settings,omitempty"`
}

// InviteMemberRequest represents a request to invite a member
type InviteMemberRequest struct {
	TeamID string   `json:"teamId"`
	Emails []string `json:"emails"`
	Role   TeamRole `json:"role"`
}

// UpdateMemberRoleRequest represents a request to update a member's role
type UpdateMemberRoleRequest struct {
	TeamID string   `json:"teamId"`
	UserID string   `json:"userId"`
	Role   TeamRole `json:"role"`
}

// NewTeamManagementService creates a new team management service
func NewTeamManagementService(
	teamRepo TeamRepository,
	userRepo UserRepository,
	queryRepo QueryRepository,
	auditLogger AuditLogger,
	logger *zap.Logger,
) *TeamManagementService {
	return &TeamManagementService{
		teamRepo:    teamRepo,
		userRepo:    userRepo,
		queryRepo:   queryRepo,
		auditLogger: auditLogger,
		logger:      logger,
	}
}

// CreateTeam creates a new team
func (s *TeamManagementService) CreateTeam(
	ctx context.Context,
	request *CreateTeamRequest,
) (*Team, error) {
	s.logger.Info("creating team",
		zap.String("name", request.Name),
		zap.String("owner_id", request.OwnerID),
	)

	// Generate team ID
	teamID := generateTeamID()

	// Generate slug from name
	slug := generateSlug(request.Name)

	// Set default settings if not provided
	settings := request.Settings
	if settings == nil {
		settings = &TeamSettings{
			MaxMembers:        10,
			DefaultRole:       RoleDeveloper,
			SharingEnabled:    true,
			ActivityRetention: 90 * 24 * time.Hour,
			RequireApproval:   false,
		}
	}

	// Create team
	team := &Team{
		ID:          teamID,
		Name:        request.Name,
		Slug:        slug,
		Description: request.Description,
		OwnerID:     request.OwnerID,
		Settings:    *settings,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Save team
	if err := s.teamRepo.Create(ctx, team); err != nil {
		return nil, fmt.Errorf("failed to create team: %w", err)
	}

	// Add owner as a member
	ownerMember := &TeamMember{
		UserID:     request.OwnerID,
		TeamID:     teamID,
		Role:       RoleOwner,
		JoinedAt:   time.Now(),
		InvitedBy:  request.OwnerID,
		Status:     StatusActive,
		LastActive: time.Now(),
	}

	if err := s.teamRepo.AddMember(ctx, teamID, ownerMember); err != nil {
		s.logger.Error("failed to add owner as member", zap.Error(err))
		// Continue anyway, team is created
	}

	// Log audit entry
	s.logAudit(ctx, teamID, request.OwnerID, "team_created", "team", teamID, map[string]interface{}{
		"name": request.Name,
		"slug": slug,
	})

	// Log activity
	s.logActivity(ctx, teamID, request.OwnerID, "team_created", map[string]interface{}{
		"team_name": request.Name,
	})

	s.logger.Info("team created successfully", zap.String("team_id", teamID))

	return team, nil
}

// GetTeam retrieves a team by ID
func (s *TeamManagementService) GetTeam(
	ctx context.Context,
	teamID string,
) (*Team, error) {
	return s.teamRepo.FindByID(ctx, teamID)
}

// UpdateTeam updates a team
func (s *TeamManagementService) UpdateTeam(
	ctx context.Context,
	teamID string,
	request *UpdateTeamRequest,
	userID string,
) (*Team, error) {
	// Get existing team
	team, err := s.teamRepo.FindByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}

	// Check permissions
	if !s.canModifyTeam(team, userID) {
		return nil, fmt.Errorf("insufficient permissions to update team")
	}

	// Apply updates
	if request.Name != nil {
		team.Name = *request.Name
		team.Slug = generateSlug(*request.Name)
	}
	if request.Description != nil {
		team.Description = *request.Description
	}
	if request.Settings != nil {
		team.Settings = *request.Settings
	}
	team.UpdatedAt = time.Now()

	// Save updates
	if err := s.teamRepo.Update(ctx, team); err != nil {
		return nil, fmt.Errorf("failed to update team: %w", err)
	}

	// Log audit entry
	s.logAudit(ctx, teamID, userID, "team_updated", "team", teamID, map[string]interface{}{
		"name": team.Name,
	})

	// Log activity
	s.logActivity(ctx, teamID, userID, "team_updated", map[string]interface{}{
		"team_name": team.Name,
	})

	return team, nil
}

// DeleteTeam deletes a team
func (s *TeamManagementService) DeleteTeam(
	ctx context.Context,
	teamID string,
	userID string,
) error {
	// Get team
	team, err := s.teamRepo.FindByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %w", err)
	}

	// Only owner can delete
	if team.OwnerID != userID {
		return fmt.Errorf("only team owner can delete the team")
	}

	// Delete team
	if err := s.teamRepo.Delete(ctx, teamID); err != nil {
		return fmt.Errorf("failed to delete team: %w", err)
	}

	// Log audit entry
	s.logAudit(ctx, teamID, userID, "team_deleted", "team", teamID, map[string]interface{}{
		"name": team.Name,
	})

	s.logger.Info("team deleted", zap.String("team_id", teamID))

	return nil
}

// InviteMembers invites users to join a team
func (s *TeamManagementService) InviteMembers(
	ctx context.Context,
	request *InviteMemberRequest,
	inviterID string,
) ([]*TeamInvitation, error) {
	s.logger.Info("inviting members to team",
		zap.String("team_id", request.TeamID),
		zap.Int("count", len(request.Emails)),
		zap.String("inviter_id", inviterID),
	)

	// Get team
	team, err := s.teamRepo.FindByID(ctx, request.TeamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}

	// Check permissions
	if !s.canInviteMembers(team, inviterID) {
		return nil, fmt.Errorf("insufficient permissions to invite members")
	}

	// Check team size limit
	members, err := s.teamRepo.FindMembers(ctx, request.TeamID)
	if err == nil {
		if len(members)+len(request.Emails) > team.Settings.MaxMembers {
			return nil, fmt.Errorf("team size limit reached (%d)", team.Settings.MaxMembers)
		}
	}

	// Create invitations
	invitations := make([]*TeamInvitation, len(request.Emails))
	for i, email := range request.Emails {
		token, _ := generateInvitationToken()

		invitations[i] = &TeamInvitation{
			ID:        generateTeamID(),
			TeamID:    request.TeamID,
			InvitedBy: inviterID,
			Email:     email,
			Role:      request.Role,
			Token:     token,
			ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days
			CreatedAt: time.Now(),
		}

		// TODO: Send invitation email
		s.logger.Info("invitation created",
			zap.String("email", email),
			zap.String("token", token),
		)
	}

	// Log audit entry
	s.logAudit(ctx, request.TeamID, inviterID, "members_invited", "team", request.TeamID, map[string]interface{}{
		"emails": request.Emails,
		"role":   request.Role,
		"count":  len(request.Emails),
	})

	// Log activity
	s.logActivity(ctx, request.TeamID, inviterID, "members_invited", map[string]interface{}{
		"count": len(request.Emails),
		"role":  request.Role,
	})

	return invitations, nil
}

// AcceptInvitation accepts a team invitation
func (s *TeamManagementService) AcceptInvitation(
	ctx context.Context,
	token string,
	userID string,
) (*Team, error) {
	// Find team by invitation token
	team, err := s.teamRepo.FindByInvitationToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("invalid invitation token: %w", err)
	}

	// Check if user is already a member
	members, _ := s.teamRepo.FindMembers(ctx, team.ID)
	for _, member := range members {
		if member.UserID == userID {
			return nil, fmt.Errorf("user is already a member of this team")
		}
	}

	// TODO: Verify invitation and get role from token
	// For now, use default role
	member := &TeamMember{
		UserID:     userID,
		TeamID:     team.ID,
		Role:       team.Settings.DefaultRole,
		JoinedAt:   time.Now(),
		InvitedBy:  team.OwnerID,
		Status:     StatusActive,
		LastActive: time.Now(),
	}

	// Add member
	if err := s.teamRepo.AddMember(ctx, team.ID, member); err != nil {
		return nil, fmt.Errorf("failed to add member: %w", err)
	}

	// Log audit entry
	s.logAudit(ctx, team.ID, userID, "invitation_accepted", "team", team.ID, map[string]interface{}{
		"token": token,
	})

	// Log activity
	s.logActivity(ctx, team.ID, userID, "member_joined", map[string]interface{}{
		"user_id": userID,
		"role":    member.Role,
	})

	s.logger.Info("user joined team",
		zap.String("team_id", team.ID),
		zap.String("user_id", userID),
	)

	return team, nil
}

// UpdateMemberRole updates a team member's role
func (s *TeamManagementService) UpdateMemberRole(
	ctx context.Context,
	request *UpdateMemberRoleRequest,
	actorID string,
) error {
	// Get team
	team, err := s.teamRepo.FindByID(ctx, request.TeamID)
	if err != nil {
		return fmt.Errorf("team not found: %w", err)
	}

	// Check permissions
	if !s.canUpdateRole(team, actorID, request.Role) {
		return nil, fmt.Errorf("insufficient permissions to update role")
	}

	// Cannot change owner role
	if request.Role == RoleOwner {
		return fmt.Errorf("cannot assign owner role")
	}

	// Update member role
	if err := s.teamRepo.UpdateMemberRole(ctx, request.TeamID, request.UserID, request.Role); err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	// Log audit entry
	s.logAudit(ctx, request.TeamID, actorID, "member_role_updated", "member", request.UserID, map[string]interface{}{
		"new_role": request.Role,
	})

	// Log activity
	s.logActivity(ctx, request.TeamID, actorID, "member_role_updated", map[string]interface{}{
		"user_id":  request.UserID,
		"new_role": request.Role,
	})

	return nil
}

// RemoveMember removes a member from a team
func (s *TeamManagementService) RemoveMember(
	ctx context.Context,
	teamID string,
	userID string,
	actorID string,
) error {
	// Get team
	team, err := s.teamRepo.FindByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %w", err)
	}

	// Cannot remove owner
	if team.OwnerID == userID {
		return fmt.Errorf("cannot remove team owner")
	}

	// Check permissions
	if !s.canRemoveMember(team, actorID) {
		return fmt.Errorf("insufficient permissions to remove member")
	}

	// Remove member
	if err := s.teamRepo.RemoveMember(ctx, teamID, userID); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	// Log audit entry
	s.logAudit(ctx, teamID, actorID, "member_removed", "member", userID, nil)

	// Log activity
	s.logActivity(ctx, teamID, actorID, "member_removed", map[string]interface{}{
		"user_id": userID,
	})

	s.logger.Info("member removed from team",
		zap.String("team_id", teamID),
		zap.String("user_id", userID),
	)

	return nil
}

// GetTeamMembers retrieves all members of a team
func (s *TeamManagementService) GetTeamMembers(
	ctx context.Context,
	teamID string,
) ([]*TeamMember, error) {
	return s.teamRepo.FindMembers(ctx, teamID)
}

// GetUserTeams retrieves all teams for a user
func (s *TeamManagementService) GetUserTeams(
	ctx context.Context,
	userID string,
) ([]*Team, error) {
	return s.teamRepo.FindByOwner(ctx, userID)
}

// GetTeamActivity retrieves activity log for a team
func (s *TeamManagementService) GetTeamActivity(
	ctx context.Context,
	teamID string,
	limit int,
) ([]*TeamActivity, error) {
	// This would query an activity log repository
	// For now, return empty slice
	return []*TeamActivity{}, nil
}

// canModifyTeam checks if a user can modify a team
func (s *TeamManagementService) canModifyTeam(team *Team, userID string) bool {
	if team.OwnerID == userID {
		return true
	}

	// Check if user is admin
	members, err := s.teamRepo.FindMembers(context.Background(), team.ID)
	if err != nil {
		return false
	}

	for _, member := range members {
		if member.UserID == userID && (member.Role == RoleAdmin || member.Role == RoleOwner) {
			return true
		}
	}

	return false
}

// canInviteMembers checks if a user can invite members
func (s *TeamManagementService) canInviteMembers(team *Team, userID string) bool {
	return s.canModifyTeam(team, userID)
}

// canUpdateRole checks if a user can update a role
func (s *TeamManagementService) canUpdateRole(team *Team, actorID string, newRole TeamRole) bool {
	// Owner can do anything
	if team.OwnerID == actorID {
		return true
	}

	// Admins can update to roles lower than admin
	if newRole == RoleAdmin || newRole == RoleOwner {
		return false
	}

	members, err := s.teamRepo.FindMembers(context.Background(), team.ID)
	if err != nil {
		return false
	}

	for _, member := range members {
		if member.UserID == actorID && member.Role == RoleAdmin {
			return true
		}
	}

	return false
}

// canRemoveMember checks if a user can remove a member
func (s *TeamManagementService) canRemoveMember(team *Team, actorID string) bool {
	return s.canModifyTeam(team, actorID)
}

// logAudit logs an audit entry
func (s *TeamManagementService) logAudit(
	ctx context.Context,
	teamID string,
	userID string,
	action string,
	resource string,
	resourceID string,
	details map[string]interface{},
) {
	entry := &AuditEntry{
		ID:        generateTeamID(),
		TeamID:    teamID,
		UserID:    userID,
		Action:    action,
		Resource:  resource,
		Details:   details,
		Timestamp: time.Now(),
	}

	if err := s.auditLogger.Log(ctx, entry); err != nil {
		s.logger.Error("failed to log audit entry", zap.Error(err))
	}
}

// logActivity logs team activity
func (s *TeamManagementService) logActivity(
	ctx context.Context,
	teamID string,
	userID string,
	action string,
	details map[string]interface{},
) {
	activity := &TeamActivity{
		ID:        generateTeamID(),
		TeamID:    teamID,
		UserID:    userID,
		Action:    action,
		Details:   details,
		CreatedAt: time.Now(),
	}

	// TODO: Store activity in repository
	s.logger.Debug("team activity logged",
		zap.String("team_id", teamID),
		zap.String("action", action),
	)
}

// Helper functions

func generateTeamID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "team_" + hex.EncodeToString(b)
}

func generateTeamID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateInvitationToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generateSlug(name string) string {
	// Simple slug generation
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	slug = strings.ReplaceAll(slug, "_", "-")
	// Remove non-alphanumeric characters
	var result strings.Builder
	for _, ch := range slug {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' {
			result.WriteRune(ch)
		}
	}
	return result.String()
}
