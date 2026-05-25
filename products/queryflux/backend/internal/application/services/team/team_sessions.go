package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Permission represents a user permission
type Permission string

const (
	PermissionView     Permission = "view"
	PermissionEdit     Permission = "edit"
	PermissionExecute  Permission = "execute"
	PermissionComment  Permission = "comment"
	PermissionShare    Permission = "share"
	PermissionManage   Permission = "manage"
	PermissionAdmin    Permission = "admin"
)

// Role represents a user role with predefined permissions
type Role string

const (
	RoleViewer     Role = "viewer"
	RoleEditor     Role = "editor"
	RoleDeveloper  Role = "developer"
	RoleAnalyst    Role = "analyst"
	RoleAdmin      Role = "admin"
	RoleOwner      Role = "owner"
)

// Cursor represents a user's cursor position in the editor
type Cursor struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// Selection represents a user's text selection in the editor
type Selection struct {
	StartLine   int `json:"start_line"`
	StartColumn int `json:"start_column"`
	EndLine     int `json:"end_line"`
	EndColumn   int `json:"end_column"`
}

// TeamSession represents a collaborative team session
type TeamSession struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	ProjectID   string                 `json:"project_id"`
	TeamID      string                 `json:"team_id"`
	CreatedBy   string                 `json:"created_by"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	IsActive    bool                   `json:"is_active"`
	Settings    SessionSettings        `json:"settings"`
	Metadata    map[string]interface{} `json:"metadata"`
	mu          sync.RWMutex
}

// SessionSettings represents session configuration
type SessionSettings struct {
	AllowAnonymous     bool          `json:"allow_anonymous"`
	RequireApproval    bool          `json:"require_approval"`
	AutoSave           bool          `json:"auto_save"`
	AutoSaveInterval   time.Duration `json:"auto_save_interval"`
	MaxParticipants    int           `json:"max_participants"`
	SessionTimeout     time.Duration `json:"session_timeout"`
	EnableRecording    bool          `json:"enable_recording"`
	EnableComments     bool          `json:"enable_comments"`
	EnableChat         bool          `json:"enable_chat"`
	EnableScreenshare  bool          `json:"enable_screenshare"`
	PasswordProtected  bool          `json:"password_protected"`
	Password           string        `json:"password,omitempty"`
}

// SessionParticipant represents a participant in a team session
type SessionParticipant struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"user_id"`
	SessionID   string                 `json:"session_id"`
	Role        Role                   `json:"role"`
	Permissions []Permission           `json:"permissions"`
	IsActive    bool                   `json:"is_active"`
	JoinedAt    time.Time              `json:"joined_at"`
	LastSeen    time.Time              `json:"last_seen"`
	Status      string                 `json:"status"` // "online", "away", "busy"
	Cursor      Cursor                 `json:"cursor"`
	Selection   Selection              `json:"selection"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// SessionActivity represents an activity in a session
type SessionActivity struct {
	ID          string                 `json:"id"`
	SessionID   string                 `json:"session_id"`
	UserID      string                 `json:"user_id"`
	Type        string                 `json:"type"` // "query", "edit", "execute", "comment", "join", "leave"
	Action      string                 `json:"action"`
	Details     map[string]interface{} `json:"details"`
	Timestamp   time.Time              `json:"timestamp"`
	IPAddress   string                 `json:"ip_address,omitempty"`
	UserAgent   string                 `json:"user_agent,omitempty"`
}

// TeamSessionManager manages team sessions and permissions
type TeamSessionManager struct {
	sessions      map[string]*TeamSession
	participants  map[string]map[string]*SessionParticipant // sessionID -> userID -> participant
	activities    map[string][]SessionActivity               // sessionID -> activities
	userSessions  map[string]map[string]bool                // userID -> sessionID -> is_active
	roles         map[Role][]Permission                     // predefined role permissions
	logger        *zap.Logger
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	metrics       *TeamSessionMetrics
}

// TeamSessionMetrics tracks team session statistics
type TeamSessionMetrics struct {
	TotalSessions       int64     `json:"total_sessions"`
	ActiveSessions      int64     `json:"active_sessions"`
	TotalParticipants   int64     `json:"total_participants"`
	ConcurrentUsers     int64     `json:"concurrent_users"`
	SessionActivities   int64     `json:"session_activities"`
	AvgSessionDuration  time.Duration `json:"avg_session_duration"`
	MostActiveSession   string    `json:"most_active_session"`
	TotalQueriesRun     int64     `json:"total_queries_run"`
	CommentsPosted      int64     `json:"comments_posted"`
	FilesShared         int64     `json:"files_shared"`
	CollaborationScore  float64   `json:"collaboration_score"`
}

// NewTeamSessionManager creates a new team session manager
func NewTeamSessionManager(logger *zap.Logger) *TeamSessionManager {
	ctx, cancel := context.WithCancel(context.Background())

	tsm := &TeamSessionManager{
		sessions:     make(map[string]*TeamSession),
		participants: make(map[string]map[string]*SessionParticipant),
		activities:   make(map[string][]SessionActivity),
		userSessions: make(map[string]map[string]bool),
		roles:        make(map[Role][]Permission),
		logger:       logger,
		ctx:          ctx,
		cancel:       cancel,
		metrics: &TeamSessionMetrics{
			TotalSessions:      0,
			ActiveSessions:     0,
			TotalParticipants: 0,
			ConcurrentUsers:    0,
			SessionActivities:  0,
			CollaborationScore: 0.0,
		},
	}

	// Initialize default roles
	tsm.initializeDefaultRoles()

	return tsm
}

// initializeDefaultRoles sets up default role permissions
func (tsm *TeamSessionManager) initializeDefaultRoles() {
	tsm.roles[RoleViewer] = []Permission{PermissionView}
	tsm.roles[RoleEditor] = []Permission{PermissionView, PermissionEdit, PermissionComment}
	tsm.roles[RoleDeveloper] = []Permission{PermissionView, PermissionEdit, PermissionExecute, PermissionComment}
	tsm.roles[RoleAnalyst] = []Permission{PermissionView, PermissionEdit, PermissionExecute, PermissionComment, PermissionShare}
	tsm.roles[RoleAdmin] = []Permission{PermissionView, PermissionEdit, PermissionExecute, PermissionComment, PermissionShare, PermissionManage}
	tsm.roles[RoleOwner] = []Permission{PermissionView, PermissionEdit, PermissionExecute, PermissionComment, PermissionShare, PermissionManage, PermissionAdmin}
}

// CreateSession creates a new team session
func (tsm *TeamSessionManager) CreateSession(name, description, projectID, teamID, createdBy string, settings SessionSettings) (*TeamSession, error) {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	sessionID := uuid.New().String()

	session := &TeamSession{
		ID:          sessionID,
		Name:        name,
		Description: description,
		ProjectID:   projectID,
		TeamID:      teamID,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsActive:    true,
		Settings:    settings,
		Metadata:    make(map[string]interface{}),
	}

	tsm.sessions[sessionID] = session
	tsm.participants[sessionID] = make(map[string]*SessionParticipant)
	tsm.activities[sessionID] = make([]SessionActivity, 0)
	tsm.metrics.TotalSessions++
	tsm.metrics.ActiveSessions++

	// Add creator as owner participant
	ownerParticipant := &SessionParticipant{
		ID:          uuid.New().String(),
		UserID:      createdBy,
		SessionID:   sessionID,
		Role:        RoleOwner,
		Permissions: tsm.roles[RoleOwner],
		IsActive:    true,
		JoinedAt:    time.Now(),
		LastSeen:    time.Now(),
		Status:      "online",
		Metadata:    make(map[string]interface{}),
	}

	tsm.participants[sessionID][createdBy] = ownerParticipant
	tsm.addUserSession(createdBy, sessionID, true)

	// Record activity
	tsm.recordActivity(sessionID, createdBy, "session", "create", map[string]interface{}{
		"session_name": name,
		"role":         string(RoleOwner),
	})

	tsm.logger.Info("Team session created",
		zap.String("session_id", sessionID),
		zap.String("name", name),
		zap.String("created_by", createdBy),
		zap.String("team_id", teamID))

	return session, nil
}

// JoinSession adds a user to a team session
func (tsm *TeamSessionManager) JoinSession(sessionID, userID string, role Role) (*SessionParticipant, error) {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	session, exists := tsm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	if !session.IsActive {
		return nil, fmt.Errorf("session %s is not active", sessionID)
	}

	// Check max participants
	if session.Settings.MaxParticipants > 0 &&
		len(tsm.participants[sessionID]) >= session.Settings.MaxParticipants {
		return nil, fmt.Errorf("session has reached maximum participants")
	}

	// Check if user already joined
	if _, exists := tsm.participants[sessionID][userID]; exists {
		return nil, fmt.Errorf("user %s already in session %s", userID, sessionID)
	}

	// Create participant
	participant := &SessionParticipant{
		ID:          uuid.New().String(),
		UserID:      userID,
		SessionID:   sessionID,
		Role:        role,
		Permissions: tsm.getRolePermissions(role),
		IsActive:    true,
		JoinedAt:    time.Now(),
		LastSeen:    time.Now(),
		Status:      "online",
		Metadata:    make(map[string]interface{}),
	}

	tsm.participants[sessionID][userID] = participant
	tsm.addUserSession(userID, sessionID, true)

	// Record activity
	tsm.recordActivity(sessionID, userID, "session", "join", map[string]interface{}{
		"role": string(role),
	})

	tsm.logger.Info("User joined team session",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID),
		zap.String("role", string(role)))

	return participant, nil
}

// LeaveSession removes a user from a team session
func (tsm *TeamSessionManager) LeaveSession(sessionID, userID string) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	session, exists := tsm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	participant, exists := tsm.participants[sessionID][userID]
	if !exists {
		return fmt.Errorf("user %s not in session %s", userID, sessionID)
	}

	// Record activity before removal
	tsm.recordActivity(sessionID, userID, "session", "leave", map[string]interface{}{
		"role":         string(participant.Role),
		"duration":     time.Since(participant.JoinedAt),
		"last_seen":    participant.LastSeen,
	})

	// Remove participant
	delete(tsm.participants[sessionID], userID)
	tsm.addUserSession(userID, sessionID, false)

	// Update session
	session.UpdatedAt = time.Now()

	tsm.logger.Info("User left team session",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID))

	return nil
}

// UpdateParticipantRole updates a participant's role
func (tsm *TeamSessionManager) UpdateParticipantRole(sessionID, userID string, newRole Role, updatedBy string) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	participant, exists := tsm.participants[sessionID][userID]
	if !exists {
		return fmt.Errorf("user %s not in session %s", userID, sessionID)
	}

	// Check permissions
	updaterParticipant, updaterExists := tsm.participants[sessionID][updatedBy]
	if !updaterExists || !tsm.hasPermission(updaterParticipant, PermissionManage) {
		return fmt.Errorf("user %s does not have permission to manage participants", updatedBy)
	}

	oldRole := participant.Role
	participant.Role = newRole
	participant.Permissions = tsm.getRolePermissions(newRole)

	// Record activity
	tsm.recordActivity(sessionID, updatedBy, "session", "role_update", map[string]interface{}{
		"target_user": userID,
		"old_role":    string(oldRole),
		"new_role":    string(newRole),
	})

	tsm.logger.Info("Participant role updated",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID),
		zap.String("old_role", string(oldRole)),
		zap.String("new_role", string(newRole)),
		zap.String("updated_by", updatedBy))

	return nil
}

// GrantPermission grants a specific permission to a participant
func (tsm *TeamSessionManager) GrantPermission(sessionID, userID string, permission Permission, grantedBy string) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	participant, exists := tsm.participants[sessionID][userID]
	if !exists {
		return fmt.Errorf("user %s not in session %s", userID, sessionID)
	}

	// Check permissions
	granterParticipant, granterExists := tsm.participants[sessionID][grantedBy]
	if !granterExists || !tsm.hasPermission(granterParticipant, PermissionManage) {
		return fmt.Errorf("user %s does not have permission to grant permissions", grantedBy)
	}

	// Add permission if not already present
	hasPermission := false
	for _, p := range participant.Permissions {
		if p == permission {
			hasPermission = true
			break
		}
	}

	if !hasPermission {
		participant.Permissions = append(participant.Permissions, permission)

		// Record activity
		tsm.recordActivity(sessionID, grantedBy, "session", "permission_grant", map[string]interface{}{
			"target_user": userID,
			"permission":  string(permission),
		})

		tsm.logger.Info("Permission granted",
			zap.String("session_id", sessionID),
			zap.String("user_id", userID),
			zap.String("permission", string(permission)),
			zap.String("granted_by", grantedBy))
	}

	return nil
}

// RevokePermission revokes a specific permission from a participant
func (tsm *TeamSessionManager) RevokePermission(sessionID, userID string, permission Permission, revokedBy string) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	participant, exists := tsm.participants[sessionID][userID]
	if !exists {
		return fmt.Errorf("user %s not in session %s", userID, sessionID)
	}

	// Check permissions
	revokerParticipant, revokerExists := tsm.participants[sessionID][revokedBy]
	if !revokerExists || !tsm.hasPermission(revokerParticipant, PermissionManage) {
		return fmt.Errorf("user %s does not have permission to revoke permissions", revokedBy)
	}

	// Remove permission
	for i, p := range participant.Permissions {
		if p == permission {
			participant.Permissions = append(participant.Permissions[:i], participant.Permissions[i+1:]...)

			// Record activity
			tsm.recordActivity(sessionID, revokedBy, "session", "permission_revoke", map[string]interface{}{
				"target_user": userID,
				"permission":  string(permission),
			})

			tsm.logger.Info("Permission revoked",
				zap.String("session_id", sessionID),
				zap.String("user_id", userID),
				zap.String("permission", string(permission)),
				zap.String("revoked_by", revokedBy))
			break
		}
	}

	return nil
}

// HasPermission checks if a user has a specific permission
func (tsm *TeamSessionManager) HasPermission(sessionID, userID string, permission Permission) bool {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	participant, exists := tsm.participants[sessionID][userID]
	if !exists {
		return false
	}

	return tsm.hasPermission(participant, permission)
}

// hasPermission checks if a participant has a permission (internal)
func (tsm *TeamSessionManager) hasPermission(participant *SessionParticipant, permission Permission) bool {
	for _, p := range participant.Permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// getRolePermissions returns permissions for a role
func (tsm *TeamSessionManager) getRolePermissions(role Role) []Permission {
	permissions, exists := tsm.roles[role]
	if !exists {
		return []Permission{}
	}

	// Return a copy to avoid modification
	result := make([]Permission, len(permissions))
	copy(result, permissions)
	return result
}

// GetSession returns a session by ID
func (tsm *TeamSessionManager) GetSession(sessionID string) (*TeamSession, error) {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	session, exists := tsm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	// Return a copy
	sessionCopy := &TeamSession{
		ID:          session.ID,
		Name:        session.Name,
		Description: session.Description,
		ProjectID:   session.ProjectID,
		TeamID:      session.TeamID,
		CreatedBy:   session.CreatedBy,
		CreatedAt:   session.CreatedAt,
		UpdatedAt:   session.UpdatedAt,
		IsActive:    session.IsActive,
		Settings:    session.Settings,
		Metadata:    make(map[string]interface{}),
	}

	// Copy metadata
	for k, v := range session.Metadata {
		sessionCopy.Metadata[k] = v
	}

	return sessionCopy, nil
}

// GetSessionParticipants returns all participants in a session
func (tsm *TeamSessionManager) GetSessionParticipants(sessionID string) ([]*SessionParticipant, error) {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	participants, exists := tsm.participants[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	result := make([]*SessionParticipant, 0, len(participants))
	for _, participant := range participants {
		participantCopy := &SessionParticipant{
			ID:          participant.ID,
			UserID:      participant.UserID,
			SessionID:   participant.SessionID,
			Role:        participant.Role,
			Permissions: make([]Permission, len(participant.Permissions)),
			IsActive:    participant.IsActive,
			JoinedAt:    participant.JoinedAt,
			LastSeen:    participant.LastSeen,
			Status:      participant.Status,
			Cursor:      participant.Cursor,
			Selection:   participant.Selection,
			Metadata:    make(map[string]interface{}),
		}

		copy(participantCopy.Permissions, participant.Permissions)

		for k, v := range participant.Metadata {
			participantCopy.Metadata[k] = v
		}

		result = append(result, participantCopy)
	}

	return result, nil
}

// GetUserSessions returns all active sessions for a user
func (tsm *TeamSessionManager) GetUserSessions(userID string) ([]*TeamSession, error) {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	userSessions, exists := tsm.userSessions[userID]
	if !exists {
		return []*TeamSession{}, nil
	}

	result := make([]*TeamSession, 0)
	for sessionID := range userSessions {
		if session, exists := tsm.sessions[sessionID]; exists && session.IsActive {
			sessionCopy := &TeamSession{
				ID:          session.ID,
				Name:        session.Name,
				Description: session.Description,
				ProjectID:   session.ProjectID,
				TeamID:      session.TeamID,
				CreatedBy:   session.CreatedBy,
				CreatedAt:   session.CreatedAt,
				UpdatedAt:   session.UpdatedAt,
				IsActive:    session.IsActive,
				Settings:    session.Settings,
				Metadata:    make(map[string]interface{}),
			}

			for k, v := range session.Metadata {
				sessionCopy.Metadata[k] = v
			}

			result = append(result, sessionCopy)
		}
	}

	return result, nil
}

// RecordActivity records an activity in a session
func (tsm *TeamSessionManager) RecordActivity(sessionID, userID, activityType, action string, details map[string]interface{}) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	return tsm.recordActivity(sessionID, userID, activityType, action, details)
}

// recordActivity records an activity (internal method)
func (tsm *TeamSessionManager) recordActivity(sessionID, userID, activityType, action string, details map[string]interface{}) error {
	activity := SessionActivity{
		ID:        uuid.New().String(),
		SessionID: sessionID,
		UserID:    userID,
		Type:      activityType,
		Action:    action,
		Details:   details,
		Timestamp: time.Now(),
	}

	tsm.activities[sessionID] = append(tsm.activities[sessionID], activity)
	tsm.metrics.SessionActivities++

	// Keep only last 1000 activities per session
	if len(tsm.activities[sessionID]) > 1000 {
		tsm.activities[sessionID] = tsm.activities[sessionID][1:]
	}

	return nil
}

// GetSessionActivities returns recent activities for a session
func (tsm *TeamSessionManager) GetSessionActivities(sessionID string, limit int) ([]SessionActivity, error) {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	activities, exists := tsm.activities[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	// Return most recent activities up to limit
	start := 0
	if len(activities) > limit {
		start = len(activities) - limit
	}

	result := make([]SessionActivity, len(activities)-start)
	copy(result, activities[start:])

	// Reverse to show most recent first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result, nil
}

// CloseSession closes a team session
func (tsm *TeamSessionManager) CloseSession(sessionID, userID string) error {
	tsm.mu.Lock()
	defer tsm.mu.Unlock()

	session, exists := tsm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	// Check permissions
	participant, exists := tsm.participants[sessionID][userID]
	if !exists || !tsm.hasPermission(participant, PermissionManage) {
		return fmt.Errorf("user %s does not have permission to close session", userID)
	}

	// Record activity
	tsm.recordActivity(sessionID, userID, "session", "close", map[string]interface{}{
		"participant_count": len(tsm.participants[sessionID]),
		"duration":         time.Since(session.CreatedAt),
	})

	// Mark session as inactive
	session.IsActive = false
	session.UpdatedAt = time.Now()
	tsm.metrics.ActiveSessions--

	// Remove all user session references
	for participantID := range tsm.participants[sessionID] {
		tsm.addUserSession(participantID, sessionID, false)
	}

	tsm.logger.Info("Team session closed",
		zap.String("session_id", sessionID),
		zap.String("closed_by", userID))

	return nil
}

// addUserSession adds or updates a user's session status
func (tsm *TeamSessionManager) addUserSession(userID, sessionID string, isActive bool) {
	if tsm.userSessions[userID] == nil {
		tsm.userSessions[userID] = make(map[string]bool)
	}

	if isActive {
		tsm.userSessions[userID][sessionID] = true
	} else {
		delete(tsm.userSessions[userID], sessionID)
		if len(tsm.userSessions[userID]) == 0 {
			delete(tsm.userSessions, userID)
		}
	}
}

// GetMetrics returns team session metrics
func (tsm *TeamSessionManager) GetMetrics() TeamSessionMetrics {
	tsm.mu.RLock()
	defer tsm.mu.RUnlock()

	// Update concurrent users count
	concurrentUsers := 0
	for _, userSessions := range tsm.userSessions {
		if len(userSessions) > 0 {
			concurrentUsers++
		}
	}

	metrics := *tsm.metrics
	metrics.ConcurrentUsers = int64(concurrentUsers)

	return metrics
}