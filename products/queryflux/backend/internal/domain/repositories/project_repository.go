package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// ProjectRepository defines the interface for project data operations
type ProjectRepository interface {
	// Create creates a new project
	Create(ctx context.Context, project *entities.Project) error

	// GetByID retrieves a project by ID
	GetByID(ctx context.Context, id string) (*entities.Project, error)

	// GetByTeamID retrieves all projects for a team
	GetByTeamID(ctx context.Context, teamID string, limit, offset int) ([]*entities.Project, error)

	// Update updates an existing project
	Update(ctx context.Context, project *entities.Project) error

	// Delete deletes a project by ID
	Delete(ctx context.Context, id string) error

	// GetByUser retrieves all projects where a user is a team member
	GetByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Project, error)

	// UpdateMetadata updates project metadata (name, description, icon, color)
	UpdateMetadata(ctx context.Context, projectID, name, description, icon, color string) error

	// Count returns the total number of projects for a team
	Count(ctx context.Context, teamID string) (int64, error)

	// Exists checks if a project exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByName checks if a project exists by name for a team
	ExistsByName(ctx context.Context, teamID, name string) (bool, error)

	// AddConnection adds a connection to a project
	AddConnection(ctx context.Context, projectConn *entities.ProjectConnection) error

	// RemoveConnection removes a connection from a project
	RemoveConnection(ctx context.Context, projectID, connectionID string) error

	// GetConnections retrieves all connections for a project
	GetConnections(ctx context.Context, projectID string) ([]*entities.ProjectConnection, error)

	// GetConnectionsByEnvironment retrieves connections by environment
	GetConnectionsByEnvironment(ctx context.Context, projectID, environment string) ([]*entities.ProjectConnection, error)

	// UpdateConnectionEnvironment updates a connection's environment in a project
	UpdateConnectionEnvironment(ctx context.Context, projectID, connectionID, environment string) error

	// UpdateConnectionOrder updates the display order of a connection in a project
	UpdateConnectionOrder(ctx context.Context, projectID, connectionID string, displayOrder int) error

	// CreateFolder creates a new folder in a project
	CreateFolder(ctx context.Context, folder *entities.ProjectFolder) error

	// GetFolders retrieves all folders for a project
	GetFolders(ctx context.Context, projectID string) ([]*entities.ProjectFolder, error)

	// GetFolder retrieves a specific folder
	GetFolder(ctx context.Context, folderID string) (*entities.ProjectFolder, error)

	// UpdateFolder updates a folder
	UpdateFolder(ctx context.Context, folder *entities.ProjectFolder) error

	// DeleteFolder deletes a folder
	DeleteFolder(ctx context.Context, folderID string) error

	// GetSubFolders retrieves subfolders of a folder
	GetSubFolders(ctx context.Context, parentFolderID string) ([]*entities.ProjectFolder, error)

	// GetRecentProjects retrieves recently accessed projects for a user
	GetRecentProjects(ctx context.Context, userID string, limit int) ([]*entities.Project, error)

	// GetProjectStats retrieves statistics for a project
	GetProjectStats(ctx context.Context, projectID string) (*ProjectStats, error)
}

// ProjectStats represents statistics for a project
type ProjectStats struct {
	ConnectionCount    int64 `json:"connection_count"`
	FolderCount        int64 `json:"folder_count"`
	MemberCount        int64 `json:"member_count"`
	QueryCount         int64 `json:"query_count"`
	LastActivityAt     string `json:"last_activity_at"`
}
