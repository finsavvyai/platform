package migrations

import (
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/mcpoverflow/api-service/internal/models"
)

// Migration represents a database migration
type Migration struct {
	ID          string    `gorm:"primary_key"`
	Name        string    `gorm:"not null"`
	ExecutedAt  time.Time `gorm:"not null"`
	Description string
}

// MigrateAll runs all pending migrations
func MigrateAll(db *gorm.DB) error {
	// First, ensure the migrations table exists
	if err := db.AutoMigrate(&Migration{}); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Define all migrations
	migrations := []Migration{
		{
			ID:          "001_create_users_table",
			Name:        "Create users table",
			Description: "Initial user table with authentication fields",
		},
		{
			ID:          "002_create_api_keys_table",
			Name:        "Create API keys table",
			Description: "Table for storing user API keys",
		},
		{
			ID:          "003_create_connectors_table",
			Name:        "Create connectors table",
			Description: "Table for storing MCP connector definitions",
		},
		{
			ID:          "004_create_agents_table",
			Name:        "Create agents table",
			Description: "Table for storing AgentKit agent definitions",
		},
		{
			ID:          "005_create_deployments_table",
			Name:        "Create deployments table",
			Description: "Table for tracking connector deployments",
		},
		{
			ID:          "006_create_analytics_table",
			Name:        "Create analytics table",
			Description: "Table for storing usage analytics and metrics",
		},
		{
			ID:          "007_create_oauth_table",
			Name:        "Create OAuth table",
			Description: "Table for storing OAuth configurations",
		},
		{
			ID:          "008_create_organizations_table",
			Name:        "Create organizations table",
			Description: "Table for managing multi-tenant organizations",
		},
		{
			ID:          "009_create_subscriptions_table",
			Name:        "Create subscriptions table",
			Description: "Table for managing user subscriptions and billing",
		},
		{
			ID:          "010_create_usage_metrics_table",
			Name:        "Create usage metrics table",
			Description: "Table for detailed usage tracking and billing",
		},
	}

	// Run each migration that hasn't been executed yet
	for _, migration := range migrations {
		if !isMigrationExecuted(db, migration.ID) {
			log.Printf("Running migration: %s", migration.Name)
			if err := runMigration(db, migration); err != nil {
				return fmt.Errorf("failed to run migration %s: %w", migration.ID, err)
			}
			log.Printf("Migration completed: %s", migration.Name)
		}
	}

	return nil
}

// isMigrationExecuted checks if a migration has already been executed
func isMigrationExecuted(db *gorm.DB, migrationID string) bool {
	var count int64
	db.Model(&Migration{}).Where("id = ?", migrationID).Count(&count)
	return count > 0
}

// runMigration executes a specific migration
func runMigration(db *gorm.DB, migration Migration) error {
	switch migration.ID {
	case "001_create_users_table":
		return migrateUsers(db)
	case "002_create_api_keys_table":
		return migrateAPIKeys(db)
	case "003_create_connectors_table":
		return migrateConnectors(db)
	case "004_create_agents_table":
		return migrateAgents(db)
	case "005_create_deployments_table":
		return migrateDeployments(db)
	case "006_create_analytics_table":
		return migrateAnalytics(db)
	case "007_create_oauth_table":
		return migrateOAuth(db)
	case "008_create_organizations_table":
		return migrateOrganizations(db)
	case "009_create_subscriptions_table":
		return migrateSubscriptions(db)
	case "010_create_usage_metrics_table":
		return migrateUsageMetrics(db)
	default:
		return fmt.Errorf("unknown migration: %s", migration.ID)
	}
}

// Individual migration functions

func migrateUsers(db *gorm.DB) error {
	return db.AutoMigrate(&models.User{})
}

func migrateAPIKeys(db *gorm.DB) error {
	return db.AutoMigrate(&models.APIKey{})
}

func migrateConnectors(db *gorm.DB) error {
	return db.AutoMigrate(&models.Connector{})
}

func migrateAgents(db *gorm.DB) error {
	return db.AutoMigrate(&models.Agent{})
}

func migrateDeployments(db *gorm.DB) error {
	return db.AutoMigrate(&models.Deployment{})
}

func migrateAnalytics(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.ConnectorAnalytics{},
		&models.AgentAnalytics{},
		&models.AgentLog{},
		&models.GenerationJob{},
	)
}

func migrateOAuth(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.OAuthProvider{},
		&models.OAuthConnection{},
		&models.OAuthTokenLog{},
	)
}

func migrateOrganizations(db *gorm.DB) error {
	// Create organization table
	type Organization struct {
		ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
		Name        string    `gorm:"not null" json:"name"`
		Slug        string    `gorm:"uniqueIndex;not null" json:"slug"`
		Description string    `json:"description"`
		Logo        string    `json:"logo"`
		Website     string    `json:"website"`
		IsActive    bool      `gorm:"default:true" json:"is_active"`
		Plan        string    `gorm:"default:free" json:"plan"`
		Settings    string    `gorm:"type:text" json:"settings"` // JSON string

		// Timestamps
		CreatedAt time.Time      `json:"created_at"`
		UpdatedAt time.Time      `json:"updated_at"`
		DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	}

	// Create user_organization join table
	type UserOrganization struct {
		UserID         uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`
		OrganizationID uuid.UUID `gorm:"type:uuid;not null" json:"organization_id"`
		Role           string    `gorm:"default:member" json:"role"`
		IsActive       bool      `gorm:"default:true" json:"is_active"`

		// Timestamps
		CreatedAt time.Time `json:"created_at"`
		UpdatedAt time.Time `json:"updated_at"`
	}

	if err := db.AutoMigrate(&Organization{}, &UserOrganization{}); err != nil {
		return err
	}

	// Create composite index for the join table
	return db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_org ON user_organizations (user_id, organization_id)").Error
}

func migrateSubscriptions(db *gorm.DB) error {
	type Subscription struct {
		ID             uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
		UserID         uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
		OrganizationID *uuid.UUID `gorm:"type:uuid" json:"organization_id,omitempty"`
		Plan           string     `gorm:"not null" json:"plan"`
		Status         string     `gorm:"not null" json:"status"`
		StartDate      time.Time  `gorm:"not null" json:"start_date"`
		EndDate        *time.Time `json:"end_date,omitempty"`
		TrialEndsAt    *time.Time `json:"trial_ends_at,omitempty"`
		CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
		ExternalID     string     `json:"external_id,omitempty"` // From payment provider

		// Usage limits
		MaxConnectors int `gorm:"default:5" json:"max_connectors"`
		MaxAPIKeys    int `gorm:"default:3" json:"max_api_keys"`
		MaxAgents     int `gorm:"default:10" json:"max_agents"`

		// Timestamps
		CreatedAt time.Time      `json:"created_at"`
		UpdatedAt time.Time      `json:"updated_at"`
		DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	}

	return db.AutoMigrate(&Subscription{})
}

func migrateUsageMetrics(db *gorm.DB) error {
	type UsageMetric struct {
		ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
		UserID      uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
		ConnectorID *uuid.UUID `gorm:"type:uuid" json:"connector_id,omitempty"`
		AgentID     *uuid.UUID `gorm:"type:uuid" json:"agent_id,omitempty"`
		MetricType  string     `gorm:"not null" json:"metric_type"`
		MetricValue float64    `gorm:"not null" json:"metric_value"`
		Unit        string     `json:"unit"`
		Timestamp   time.Time  `gorm:"not null" json:"timestamp"`
		Metadata    string     `gorm:"type:text" json:"metadata"` // JSON string for additional data

		// Timestamps
		CreatedAt time.Time      `json:"created_at"`
		UpdatedAt time.Time      `json:"updated_at"`
		DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	}

	return db.AutoMigrate(&UsageMetric{})
}

// RollbackMigration rolls back a specific migration (for development)
func RollbackMigration(db *gorm.DB, migrationID string) error {
	switch migrationID {
	case "010_create_usage_metrics_table":
		return db.Migrator().DropTable("usage_metrics")
	case "009_create_subscriptions_table":
		return db.Migrator().DropTable("subscriptions")
	case "008_create_organizations_table":
		return db.Migrator().DropTable("organizations", "user_organizations")
	case "007_create_oauth_table":
		return db.Migrator().DropTable("oauth_configs")
	case "006_create_analytics_table":
		return db.Migrator().DropTable("analytics")
	case "005_create_deployments_table":
		return db.Migrator().DropTable("deployments")
	case "004_create_agents_table":
		return db.Migrator().DropTable("agents")
	case "003_create_connectors_table":
		return db.Migrator().DropTable("connectors")
	case "002_create_api_keys_table":
		return db.Migrator().DropTable("api_keys")
	case "001_create_users_table":
		return db.Migrator().DropTable("users")
	default:
		return fmt.Errorf("unknown migration to rollback: %s", migrationID)
	}
}

// SeedData creates initial seed data
func SeedData(db *gorm.DB) error {
	log.Println("Running database seed...")

	// Create default admin user if it doesn't exist
	var adminCount int64
	db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&adminCount)
	if adminCount == 0 {
		adminUser := models.User{
			Email:     "admin@mcpoverflow.com",
			FirstName: "System",
			LastName:  "Administrator",
			Role:      models.RoleAdmin,
			IsActive:  true,
		}

		if err := db.Create(&adminUser).Error; err != nil {
			return fmt.Errorf("failed to create admin user: %w", err)
		}
		log.Println("Created default admin user")
	}

	// Record migration completion
	migration := Migration{
		ID:          "seed_data",
		Name:        "Seed Data",
		Description: "Initial seed data for the application",
		ExecutedAt:  time.Now(),
	}

	return db.Create(&migration).Error
}
