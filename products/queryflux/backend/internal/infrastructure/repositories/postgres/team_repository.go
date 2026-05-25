package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// teamRepository implements the TeamRepository interface for PostgreSQL
type teamRepository struct {
	db PgxIface
}

// NewTeamRepository creates a new PostgreSQL team repository
func NewTeamRepository(db PgxIface) repositories.TeamRepository {
	return &teamRepository{db: db}
}

// Create creates a new team
func (r *teamRepository) Create(ctx context.Context, team *entities.Team) error {
	query := `
		INSERT INTO teams (id, name, description, owner_id, plan, settings, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.Exec(ctx, query,
		team.ID,
		team.Name,
		team.Description,
		team.OwnerID,
		team.Plan,
		team.Settings,
		team.CreatedAt,
		team.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create team: %w", err)
	}

	return nil
}

// GetByID retrieves a team by ID
func (r *teamRepository) GetByID(ctx context.Context, id string) (*entities.Team, error) {
	query := `
		SELECT id, name, description, owner_id, plan, settings, created_at, updated_at
		FROM teams
		WHERE id = $1
	`

	var team entities.Team
	err := r.db.QueryRow(ctx, query, id).Scan(
		&team.ID,
		&team.Name,
		&team.Description,
		&team.OwnerID,
		&team.Plan,
		&team.Settings,
		&team.CreatedAt,
		&team.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("team not found")
		}
		return nil, fmt.Errorf("failed to get team: %w", err)
	}

	return &team, nil
}

// GetByOwnerID retrieves all teams owned by a user
func (r *teamRepository) GetByOwnerID(ctx context.Context, ownerID string, limit, offset int) ([]*entities.Team, error) {
	query := `
		SELECT id, name, description, owner_id, plan, settings, created_at, updated_at
		FROM teams
		WHERE owner_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, ownerID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get teams by owner: %w", err)
	}
	defer rows.Close()

	var teams []*entities.Team
	for rows.Next() {
		var team entities.Team
		err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.Description,
			&team.OwnerID,
			&team.Plan,
			&team.Settings,
			&team.CreatedAt,
			&team.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, &team)
	}

	return teams, nil
}

// Update updates an existing team
func (r *teamRepository) Update(ctx context.Context, team *entities.Team) error {
	query := `
		UPDATE teams
		SET name = $2, description = $3, plan = $4, settings = $5, updated_at = $6
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query,
		team.ID,
		team.Name,
		team.Description,
		team.Plan,
		team.Settings,
		team.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update team: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team not found")
	}

	return nil
}

// Delete deletes a team by ID
func (r *teamRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM teams WHERE id = $1`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete team: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team not found")
	}

	return nil
}

// GetByMemberID retrieves all teams where a user is a member
func (r *teamRepository) GetByMemberID(ctx context.Context, memberID string, limit, offset int) ([]*entities.Team, error) {
	query := `
		SELECT DISTINCT t.id, t.name, t.description, t.owner_id, t.plan, t.settings, t.created_at, t.updated_at
		FROM teams t
		INNER JOIN team_members tm ON t.id = tm.team_id
		WHERE tm.user_id = $1
		ORDER BY t.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, memberID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get teams by member: %w", err)
	}
	defer rows.Close()

	var teams []*entities.Team
	for rows.Next() {
		var team entities.Team
		err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.Description,
			&team.OwnerID,
			&team.Plan,
			&team.Settings,
			&team.CreatedAt,
			&team.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team: %w", err)
		}
		teams = append(teams, &team)
	}

	return teams, nil
}

// UpdateSettings updates the team settings
func (r *teamRepository) UpdateSettings(ctx context.Context, teamID, settings string) error {
	query := `UPDATE teams SET settings = $2, updated_at = $3 WHERE id = $1`

	now := time.Now()
	result, err := r.db.Exec(ctx, query, teamID, settings, now)
	if err != nil {
		return fmt.Errorf("failed to update team settings: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team not found")
	}

	return nil
}

// UpdatePlan updates the team's subscription plan
func (r *teamRepository) UpdatePlan(ctx context.Context, teamID, plan string) error {
	query := `UPDATE teams SET plan = $2, updated_at = $3 WHERE id = $1`

	now := time.Now()
	result, err := r.db.Exec(ctx, query, teamID, plan, now)
	if err != nil {
		return fmt.Errorf("failed to update team plan: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team not found")
	}

	return nil
}

// Count returns the total number of teams for an owner
func (r *teamRepository) Count(ctx context.Context, ownerID string) (int64, error) {
	query := `SELECT COUNT(*) FROM teams WHERE owner_id = $1`

	var count int64
	err := r.db.QueryRow(ctx, query, ownerID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count teams: %w", err)
	}

	return count, nil
}

// Exists checks if a team exists by ID
func (r *teamRepository) Exists(ctx context.Context, id string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM teams WHERE id = $1)`

	var exists bool
	err := r.db.QueryRow(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check team existence: %w", err)
	}

	return exists, nil
}

// ExistsByName checks if a team exists by name for an owner
func (r *teamRepository) ExistsByName(ctx context.Context, ownerID, name string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM teams WHERE owner_id = $1 AND name = $2)`

	var exists bool
	err := r.db.QueryRow(ctx, query, ownerID, name).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check team existence by name: %w", err)
	}

	return exists, nil
}

// AddMember adds a member to a team
func (r *teamRepository) AddMember(ctx context.Context, member *entities.TeamMember) error {
	query := `
		INSERT INTO team_members (id, team_id, user_id, role, joined_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.Exec(ctx, query,
		member.ID,
		member.TeamID,
		member.UserID,
		member.Role,
		member.JoinedAt,
		member.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to add team member: %w", err)
	}

	return nil
}

// RemoveMember removes a member from a team
func (r *teamRepository) RemoveMember(ctx context.Context, teamID, userID string) error {
	query := `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`

	result, err := r.db.Exec(ctx, query, teamID, userID)
	if err != nil {
		return fmt.Errorf("failed to remove team member: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team member not found")
	}

	return nil
}

// GetMembers retrieves all members of a team
func (r *teamRepository) GetMembers(ctx context.Context, teamID string, limit, offset int) ([]*entities.TeamMember, error) {
	query := `
		SELECT id, team_id, user_id, role, joined_at, updated_at
		FROM team_members
		WHERE team_id = $1
		ORDER BY joined_at ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, teamID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get team members: %w", err)
	}
	defer rows.Close()

	var members []*entities.TeamMember
	for rows.Next() {
		var member entities.TeamMember
		err := rows.Scan(
			&member.ID,
			&member.TeamID,
			&member.UserID,
			&member.Role,
			&member.JoinedAt,
			&member.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}
		members = append(members, &member)
	}

	return members, nil
}

// GetMember retrieves a specific team member
func (r *teamRepository) GetMember(ctx context.Context, teamID, userID string) (*entities.TeamMember, error) {
	query := `
		SELECT id, team_id, user_id, role, joined_at, updated_at
		FROM team_members
		WHERE team_id = $1 AND user_id = $2
	`

	var member entities.TeamMember
	err := r.db.QueryRow(ctx, query, teamID, userID).Scan(
		&member.ID,
		&member.TeamID,
		&member.UserID,
		&member.Role,
		&member.JoinedAt,
		&member.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("team member not found")
		}
		return nil, fmt.Errorf("failed to get team member: %w", err)
	}

	return &member, nil
}

// UpdateMemberRole updates a member's role in a team
func (r *teamRepository) UpdateMemberRole(ctx context.Context, teamID, userID, role string) error {
	query := `UPDATE team_members SET role = $3, updated_at = $4 WHERE team_id = $1 AND user_id = $2`

	now := time.Now()
	result, err := r.db.Exec(ctx, query, teamID, userID, role, now)
	if err != nil {
		return fmt.Errorf("failed to update member role: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("team member not found")
	}

	return nil
}

// IsMember checks if a user is a member of a team
func (r *teamRepository) IsMember(ctx context.Context, teamID, userID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2)`

	var exists bool
	err := r.db.QueryRow(ctx, query, teamID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check team membership: %w", err)
	}

	return exists, nil
}

// GetMemberRole retrieves a member's role in a team
func (r *teamRepository) GetMemberRole(ctx context.Context, teamID, userID string) (string, error) {
	query := `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`

	var role string
	err := r.db.QueryRow(ctx, query, teamID, userID).Scan(&role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("team member not found")
		}
		return "", fmt.Errorf("failed to get member role: %w", err)
	}

	return role, nil
}

// CreateInvitation creates a new team invitation
func (r *teamRepository) CreateInvitation(ctx context.Context, invitation *entities.TeamInvitation) error {
	query := `
		INSERT INTO team_invitations (id, team_id, inviter_id, invitee_email, role, status, token, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := r.db.Exec(ctx, query,
		invitation.ID,
		invitation.TeamID,
		invitation.InviterID,
		invitation.InviteeEmail,
		invitation.Role,
		invitation.Status,
		invitation.Token,
		invitation.ExpiresAt,
		invitation.CreatedAt,
		invitation.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create team invitation: %w", err)
	}

	return nil
}

// GetInvitationByToken retrieves an invitation by token
func (r *teamRepository) GetInvitationByToken(ctx context.Context, token string) (*entities.TeamInvitation, error) {
	query := `
		SELECT id, team_id, inviter_id, invitee_email, role, status, token, expires_at, created_at, updated_at
		FROM team_invitations
		WHERE token = $1
	`

	var invitation entities.TeamInvitation
	err := r.db.QueryRow(ctx, query, token).Scan(
		&invitation.ID,
		&invitation.TeamID,
		&invitation.InviterID,
		&invitation.InviteeEmail,
		&invitation.Role,
		&invitation.Status,
		&invitation.Token,
		&invitation.ExpiresAt,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invitation not found")
		}
		return nil, fmt.Errorf("failed to get invitation: %w", err)
	}

	return &invitation, nil
}

// GetInvitations retrieves all pending invitations for a team
func (r *teamRepository) GetInvitations(ctx context.Context, teamID string, limit, offset int) ([]*entities.TeamInvitation, error) {
	query := `
		SELECT id, team_id, inviter_id, invitee_email, role, status, token, expires_at, created_at, updated_at
		FROM team_invitations
		WHERE team_id = $1 AND status = 'pending'
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, teamID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get team invitations: %w", err)
	}
	defer rows.Close()

	var invitations []*entities.TeamInvitation
	for rows.Next() {
		var invitation entities.TeamInvitation
		err := rows.Scan(
			&invitation.ID,
			&invitation.TeamID,
			&invitation.InviterID,
			&invitation.InviteeEmail,
			&invitation.Role,
			&invitation.Status,
			&invitation.Token,
			&invitation.ExpiresAt,
			&invitation.CreatedAt,
			&invitation.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan invitation: %w", err)
		}
		invitations = append(invitations, &invitation)
	}

	return invitations, nil
}

// UpdateInvitationStatus updates an invitation's status
func (r *teamRepository) UpdateInvitationStatus(ctx context.Context, invitationID, status string) error {
	query := `UPDATE team_invitations SET status = $2, updated_at = $3 WHERE id = $1`

	now := time.Now()
	result, err := r.db.Exec(ctx, query, invitationID, status, now)
	if err != nil {
		return fmt.Errorf("failed to update invitation status: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("invitation not found")
	}

	return nil
}

// DeleteInvitation deletes an invitation
func (r *teamRepository) DeleteInvitation(ctx context.Context, invitationID string) error {
	query := `DELETE FROM team_invitations WHERE id = $1`

	result, err := r.db.Exec(ctx, query, invitationID)
	if err != nil {
		return fmt.Errorf("failed to delete invitation: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("invitation not found")
	}

	return nil
}

// GetPendingInvitationsForEmail retrieves pending invitations for an email
func (r *teamRepository) GetPendingInvitationsForEmail(ctx context.Context, email string) ([]*entities.TeamInvitation, error) {
	query := `
		SELECT id, team_id, inviter_id, invitee_email, role, status, token, expires_at, created_at, updated_at
		FROM team_invitations
		WHERE invitee_email = $1 AND status = 'pending' AND expires_at > NOW()
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, email)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending invitations: %w", err)
	}
	defer rows.Close()

	var invitations []*entities.TeamInvitation
	for rows.Next() {
		var invitation entities.TeamInvitation
		err := rows.Scan(
			&invitation.ID,
			&invitation.TeamID,
			&invitation.InviterID,
			&invitation.InviteeEmail,
			&invitation.Role,
			&invitation.Status,
			&invitation.Token,
			&invitation.ExpiresAt,
			&invitation.CreatedAt,
			&invitation.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan invitation: %w", err)
		}
		invitations = append(invitations, &invitation)
	}

	return invitations, nil
}

// CleanupExpiredInvitations removes expired invitations
func (r *teamRepository) CleanupExpiredInvitations(ctx context.Context) (int64, error) {
	query := `DELETE FROM team_invitations WHERE expires_at <= NOW()`

	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired invitations: %w", err)
	}

	return result.RowsAffected(), nil
}
