package entities

import (
	"time"

	"github.com/google/uuid"
)

// Project represents a database management project within a team
type Project struct {
	ID          string    `json:"id" db:"id"`
	TeamID      string    `json:"team_id" db:"team_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Icon        string    `json:"icon" db:"icon"`
	Color       string    `json:"color" db:"color"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// NewProject creates a new project with generated ID and timestamps
func NewProject(teamID, name, description, createdBy string) *Project {
	now := time.Now()
	return &Project{
		ID:          uuid.New().String(),
		TeamID:      teamID,
		Name:        name,
		Description: description,
		Icon:        "database",
		Color:       "#3b82f6",
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// ProjectConnection represents a connection associated with a project
type ProjectConnection struct {
	ID            string    `json:"id" db:"id"`
	ProjectID     string    `json:"project_id" db:"project_id"`
	ConnectionID  string    `json:"connection_id" db:"connection_id"`
	Environment   string    `json:"environment" db:"environment"` // development, staging, production
	DisplayOrder  int       `json:"display_order" db:"display_order"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// NewProjectConnection creates a new project connection with generated ID and timestamps
func NewProjectConnection(projectID, connectionID, environment string, displayOrder int) *ProjectConnection {
	now := time.Now()
	return &ProjectConnection{
		ID:           uuid.New().String(),
		ProjectID:    projectID,
		ConnectionID: connectionID,
		Environment:  environment,
		DisplayOrder: displayOrder,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// ProjectFolder represents a folder for organizing connections within a project
type ProjectFolder struct {
	ID            string    `json:"id" db:"id"`
	ProjectID     string    `json:"project_id" db:"project_id"`
	Name          string    `json:"name" db:"name"`
	ParentFolderID *string  `json:"parent_folder_id" db:"parent_folder_id"`
	DisplayOrder  int       `json:"display_order" db:"display_order"`
	CreatedBy     string    `json:"created_by" db:"created_by"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// NewProjectFolder creates a new project folder with generated ID and timestamps
func NewProjectFolder(projectID, name, createdBy string, parentFolderID *string, displayOrder int) *ProjectFolder {
	now := time.Now()
	return &ProjectFolder{
		ID:            uuid.New().String(),
		ProjectID:     projectID,
		Name:          name,
		ParentFolderID: parentFolderID,
		DisplayOrder:  displayOrder,
		CreatedBy:     createdBy,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}
